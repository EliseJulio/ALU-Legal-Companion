// Email that tells the other person something changed. Three cases:
//   an appointment is accepted     -> the signed-in person gets the time and the meeting link
//   a shared document changes      -> the lawyer it is shared with is told to look
//   the lawyer comments or checks  -> the owner is told to look
// An email says that something changed and where to look. It never carries the text of a comment, a
// document name or a matter title, because those are the person's own words.
import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';
import { whenSettled, resetNotifyThrottle } from '../../src/services/notify.js';

const PDF = (text) => Buffer.from(`%PDF-1.4\n${text}\n%%EOF`);
const ROOM = 'https://meet.google.com/abc-defg-hij';
const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

let dir;
let mails;
let student;
let expert;
let lawyer;

beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notify-')); });
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

beforeEach(async () => {
  process.env.DOCUMENT_KEY = 'ab'.repeat(32);
  process.env.DOCUMENTS_DIR = dir;
  mails = [];
  jest.spyOn(console, 'log').mockImplementation((text) => { mails.push(String(text)); });
  resetNotifyThrottle();
  await resetDb();
  student = await makeUser('student', 'student@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
  lawyer = await makeProvider({ name: 'Adv. Amani', category: 'lawyer', type: 'pro_bono_lawyer', bookable: true, meet_link: ROOM, user_id: expert.user.id }, { verifiedBy: expert.user.id });
});
afterEach(() => jest.restoreAllMocks());

const sentTo = (address) => mails.filter((m) => m.includes(`To:      ${address}`));

describe('an accepted appointment', () => {
  const book = (who, over = {}) => request(app).post('/api/bookings').set('Authorization', who.auth)
    .send({ provider_id: lawyer.id, slot: inDays(3), topic: 'My deposit', ...over });
  const setStatus = (id, status) => request(app).post(`/api/bookings/${id}/status`).set('Authorization', expert.auth).send({ status });

  test('emails the signed-in person the time and the meeting link', async () => {
    const booking = (await book(student)).body;
    expect((await setStatus(booking.id, 'accepted')).status).toBe(200);
    await whenSettled();
    const [mail] = sentTo('student@alustudent.com');
    expect(mail).toContain('accepted');
    expect(mail).toContain('Adv. Amani');
    expect(mail).toContain(ROOM);
    expect(mail).toContain('admit');
  });

  test('says so when the lawyer has not added a meeting link yet', async () => {
    await q('UPDATE providers SET meet_link = NULL WHERE id = $1', [lawyer.id]);
    const booking = (await book(student)).body;
    await setStatus(booking.id, 'accepted');
    await whenSettled();
    const [mail] = sentTo('student@alustudent.com');
    expect(mail).toContain('has not added a meeting link');
  });

  test('sends nothing for an anonymous booking, which has no address', async () => {
    const res = await request(app).post('/api/bookings/anonymous').send({ provider_id: lawyer.id, slot: inDays(3) });
    await setStatus(res.body.id, 'accepted');
    await whenSettled();
    expect(mails.filter((m) => m.includes('mail: DEV MODE'))).toHaveLength(0);
  });

  test('sends nothing when the booking is declined or completed', async () => {
    const booking = (await book(student)).body;
    await setStatus(booking.id, 'declined');
    await whenSettled();
    expect(sentTo('student@alustudent.com')).toHaveLength(0);
  });

  test('a mail that fails to send never breaks the status change', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.SMTP_URL = 'smtp://127.0.0.1:1';
    try {
      const booking = (await book(student)).body;
      const res = await setStatus(booking.id, 'accepted');
      await whenSettled();
      expect(res.status).toBe(200);
      expect(errors).toHaveBeenCalled();
    } finally {
      process.env.SMTP_URL = '';
    }
  });
});

describe('documents on a shared matter', () => {
  let matter;
  const upload = (label, extra = '') => request(app)
    .post(`/api/matters/${matter.id}/documents?label=${encodeURIComponent(label)}${extra}`)
    .set('Authorization', student.auth).set('Content-Type', 'application/pdf').send(PDF(label));

  beforeEach(async () => {
    matter = (await request(app).post('/api/matters').set('Authorization', student.auth).send({ title: 'Buying my private car' })).body;
  });
  const share = () => request(app).post(`/api/matters/${matter.id}/share`).set('Authorization', student.auth).send({ provider_id: lawyer.id }).expect(200);

  test('the lawyer is emailed when the owner adds, replaces or removes a document', async () => {
    await share();
    const first = (await upload('Sale agreement')).body;
    await whenSettled();
    expect(sentTo('expert@example.org')).toHaveLength(1);
    resetNotifyThrottle();
    const second = (await upload('Sale agreement v2', `&replaces=${first.id}`)).body;
    await whenSettled();
    expect(sentTo('expert@example.org')).toHaveLength(2);
    resetNotifyThrottle();
    await request(app).delete(`/api/matters/${matter.id}/documents/${second.id}`).set('Authorization', student.auth).expect(204);
    await whenSettled();
    expect(sentTo('expert@example.org')).toHaveLength(3);
  });

  test('the email names no document, no matter title and no owner', async () => {
    await share();
    await upload('Passport of Jane Doe');
    await whenSettled();
    const [mail] = sentTo('expert@example.org');
    expect(mail).not.toContain('Passport');
    expect(mail).not.toContain('Jane');
    expect(mail).not.toContain('private car');
    expect(mail).not.toContain('student@alustudent.com');
    expect(mail).toContain(`/matters/${matter.id}`);
  });

  test('a burst of uploads sends the lawyer one email, not one for each file', async () => {
    await share();
    await upload('One');
    await upload('Two');
    await upload('Three');
    await whenSettled();
    expect(sentTo('expert@example.org')).toHaveLength(1);
  });

  test('nobody is emailed while the matter is not shared', async () => {
    await upload('Sale agreement');
    await whenSettled();
    expect(mails.filter((m) => m.includes('mail: DEV MODE'))).toHaveLength(0);
  });

  test('the owner is emailed when the lawyer comments and the comment text is not in it', async () => {
    await share();
    const doc = (await upload('Sale agreement')).body;
    mails.length = 0;
    await request(app).post(`/api/matters/${matter.id}/documents/${doc.id}/comments`)
      .set('Authorization', expert.auth).send({ body: 'The plate number is wrong on page two.' }).expect(201);
    await whenSettled();
    const [mail] = sentTo('student@alustudent.com');
    expect(mail).toContain('comment');
    expect(mail).not.toContain('plate number');
    expect(mail).toContain(`/matters/${matter.id}`);
  });

  test('the owner is emailed when the lawyer records a verdict', async () => {
    await share();
    const doc = (await upload('Sale agreement')).body;
    mails.length = 0;
    await request(app).put(`/api/matters/${matter.id}/documents/${doc.id}/review`)
      .set('Authorization', expert.auth).send({ status: 'needs_fix', note: 'Missing the seller signature.' }).expect(200);
    await whenSettled();
    const [mail] = sentTo('student@alustudent.com');
    expect(mail).toContain('checked');
    expect(mail).not.toContain('signature');
  });

  test('a switched-off account gets nothing', async () => {
    await share();
    await q('UPDATE users SET deactivated_at = now() WHERE id = $1', [expert.user.id]);
    await upload('Sale agreement');
    await whenSettled();
    expect(sentTo('expert@example.org')).toHaveLength(0);
  });
});

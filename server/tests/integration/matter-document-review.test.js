// A lawyer's verdict on a document. Only the legal expert the matter is shared with at this moment
// can give one. The owner cannot check their own files because the point is an independent look. And
// a verdict belongs to one file. A replacement file is a new row. So a verdict never follows
// different bytes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

const PDF = (text) => Buffer.from(`%PDF-1.4\n${text}\n%%EOF`);

let dir;
let student;
let other;
let expert;
let stranger;
let matter;
let doc;

beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matter-review-')); });
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

beforeEach(async () => {
  process.env.DOCUMENT_KEY = 'cd'.repeat(32);
  process.env.DOCUMENTS_DIR = dir;
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
  await resetDb();
  student = await makeUser('student', 'student@alustudent.com');
  other = await makeUser('student', 'other@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
  stranger = await makeUser('legal_expert', 'stranger@example.org');
  const lawyer = await makeProvider({ name: 'Adv. Amani', category: 'lawyer', type: 'pro_bono_lawyer' }, { verifiedBy: expert.user.id });
  await q('UPDATE providers SET user_id = $1 WHERE id = $2', [expert.user.id, lawyer.id]);

  matter = (await request(app).post('/api/matters').set('Authorization', student.auth).send({ title: 'Buying a car' })).body;
  doc = (await upload('Sale agreement')).body;
  await request(app).post(`/api/matters/${matter.id}/share`).set('Authorization', student.auth).send({ provider_id: lawyer.id }).expect(200);
});

const upload = (label, { replaces, text = label, user = student, matterId } = {}) =>
  request(app).post(`/api/matters/${matterId ?? matter.id}/documents?label=${encodeURIComponent(label)}${replaces ? `&replaces=${replaces}` : ''}`)
    .set('Authorization', user.auth).set('Content-Type', 'application/pdf').send(PDF(text));
const review = (id, body, user = expert, matterId = undefined) =>
  request(app).put(`/api/matters/${matterId ?? matter.id}/documents/${id}/review`).set('Authorization', user.auth).send(body);
const list = (user = student) => request(app).get(`/api/matters/${matter.id}/documents`).set('Authorization', user.auth);
const history = async (user = student) =>
  (await request(app).get(`/api/matters/${matter.id}`).set('Authorization', user.auth)).body.events;

describe('a verdict of a lawyer', () => {
  it('the shared lawyer can mark a document complete and the owner sees it', async () => {
    const res = await review(doc.id, { status: 'complete' });
    expect(res.status).toBe(200);
    expect(res.body.review.status).toBe('complete');
    const seen = (await list()).body[0];
    expect(seen.review.status).toBe('complete');
    expect(seen.review.reviewed_at).toBeTruthy();
  });

  it('needs fixing and out of date carry a note the owner can read', async () => {
    await review(doc.id, { status: 'needs_fix', note: 'The plate number is missing.' }).expect(200);
    expect((await list()).body[0].review).toMatchObject({ status: 'needs_fix', note: 'The plate number is missing.' });
    await review(doc.id, { status: 'out_of_date', note: 'This is last year\'s.' }).expect(200);
    expect((await list()).body[0].review.status).toBe('out_of_date');
  });

  it('a note is required when the verdict is not complete', async () => {
    expect((await review(doc.id, { status: 'needs_fix' })).status).toBe(400);
    expect((await review(doc.id, { status: 'out_of_date', note: '   ' })).status).toBe(400);
    expect((await list()).body[0].review.status).toBe('pending');
  });

  it('only the three verdicts are accepted. Pending cannot be set by hand', async () => {
    for (const status of ['pending', 'approved', '', undefined]) {
      expect((await review(doc.id, { status, note: 'x' })).status).toBe(400);
    }
  });

  it('a note is bounded', async () => {
    expect((await review(doc.id, { status: 'needs_fix', note: 'x'.repeat(1001) })).status).toBe(400);
    expect((await review(doc.id, { status: 'needs_fix', note: 'x'.repeat(1000) })).status).toBe(200);
  });

  it('the verdict is written into the history of the matter as an entry of the lawyer', async () => {
    await review(doc.id, { status: 'complete' });
    const events = await history();
    const entry = events.find((e) => /Checked “Sale agreement”: looks complete/.test(e.description));
    expect(entry).toBeTruthy();
    // It can never pass for a note of the owner.
    expect(entry.author_is_owner).toBe(false);
  });

  it('the lawyer sees their own verdict on the list too', async () => {
    await review(doc.id, { status: 'complete' });
    expect((await list(expert)).body[0].review.status).toBe('complete');
  });
});

describe('who may give one. A 404 and never a 403', () => {
  it('the owner cannot mark their own document checked', async () => {
    expect((await review(doc.id, { status: 'complete' }, student)).status).toBe(404);
    expect((await list()).body[0].review.status).toBe('pending');
  });

  it('another student, a lawyer it is not shared with and a visitor cannot', async () => {
    expect((await review(doc.id, { status: 'complete' }, other)).status).toBe(404);
    expect((await review(doc.id, { status: 'complete' }, stranger)).status).toBe(404);
    expect((await request(app).put(`/api/matters/${matter.id}/documents/${doc.id}/review`).send({ status: 'complete' })).status).toBe(401);
    expect((await list()).body[0].review.status).toBe('pending');
  });

  it('stopping the share ends the lawyer\'s ability to review on the next request', async () => {
    await request(app).delete(`/api/matters/${matter.id}/share`).set('Authorization', student.auth).expect(200);
    expect((await review(doc.id, { status: 'complete' })).status).toBe(404);
  });

  it('a document from another matter cannot be reviewed through this one', async () => {
    const elsewhere = (await request(app).post('/api/matters').set('Authorization', other.auth).send({ title: 'Mine' })).body;
    const theirs = (await upload('Passport', { user: other, matterId: elsewhere.id })).body;
    expect((await review(theirs.id, { status: 'complete' })).status).toBe(404);
  });
});

describe('replacing a document starts the check again', () => {
  it('the new file is pending, the old one is gone and the count does not grow', async () => {
    await review(doc.id, { status: 'complete' });
    const replacement = (await upload('Sale agreement', { replaces: doc.id, text: 'new bytes' })).body;
    expect(replacement.id).not.toBe(doc.id);
    expect(replacement.review.status).toBe('pending');
    const files = (await list()).body;
    expect(files).toHaveLength(1);
    expect(files[0].id).toBe(replacement.id);
    expect(fs.readdirSync(dir)).toHaveLength(1);
  });

  it('replacing is allowed even when the matter is full', async () => {
    for (let i = 0; i < 24; i += 1) await upload(`Doc ${i}`).expect(201);
    expect((await upload('One too many')).status).toBe(400);
    expect((await upload('Sale agreement', { replaces: doc.id })).status).toBe(201);
  });

  it('"replaces" must name a document on this matter', async () => {
    const elsewhere = (await request(app).post('/api/matters').set('Authorization', other.auth).send({ title: 'Mine' })).body;
    const theirs = (await upload('Passport', { user: other, matterId: elsewhere.id })).body;
    expect((await upload('X', { replaces: theirs.id })).status).toBe(400);
    expect((await upload('X', { replaces: 99999 })).status).toBe(400);
    expect((await upload('X', { replaces: 'abc' })).status).toBe(400);
    expect(await q('SELECT id FROM matter_documents')).toHaveLength(2); // nothing was added or removed
  });

  it('a replacement that fails validation leaves the original untouched', async () => {
    await review(doc.id, { status: 'complete' });
    const bad = await request(app)
      .post(`/api/matters/${matter.id}/documents?label=Sale&replaces=${doc.id}`)
      .set('Authorization', student.auth).set('Content-Type', 'application/pdf').send(Buffer.from('<html>not a pdf</html>'));
    expect(bad.status).toBe(400);
    const files = (await list()).body;
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ id: doc.id });
    expect(files[0].review.status).toBe('complete');
    expect(fs.readdirSync(dir)).toHaveLength(1);
  });
});

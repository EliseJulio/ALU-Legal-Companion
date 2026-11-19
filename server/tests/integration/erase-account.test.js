// A student or staff member erasing their own account: DELETE /api/auth/me.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import app from '../../src/app.js';
import { jest } from '@jest/globals';
import { q } from '../../src/db.js';
import { whenSettled, resetNotifyThrottle } from '../../src/services/notify.js';
import { resetDb, makeUser, makeMatter, makeProvider } from '../helpers.js';

const PASSWORD = 'password1234'; // what makeUser gives every test account
const PDF = Buffer.from('%PDF-1.4\nsecret\n%%EOF');

let dir;
let student;
let other;
let expert;
beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'erase-docs-')); });
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

// Files kept in the database. The folder is only checked to stay empty.
const storedCount = async () => (await q(
  'SELECT ((SELECT count(*) FROM matter_documents WHERE content IS NOT NULL) + (SELECT count(*) FROM matter_event_files WHERE content IS NOT NULL))::int AS n'))[0].n;
beforeEach(async () => {
  process.env.DOCUMENT_KEY = 'ab'.repeat(32);
  process.env.DOCUMENTS_DIR = dir;
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  await resetDb();
  student = await makeUser('student', 'student@alustudent.com');
  other = await makeUser('student', 'other@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
});

const erase = (user, body) => request(app).delete('/api/auth/me').set('Authorization', user.auth).send(body);
const good = { password: PASSWORD, confirm: true };
const count = async (sql, params) => (await q(sql, params))[0].n;
const upload = (user, matterId) =>
  request(app).post(`/api/matters/${matterId}/documents?label=Passport`)
    .set('Authorization', user.auth).set('Content-Type', 'application/pdf').send(PDF);

describe('refusals change nothing', () => {
  it('needs a login', async () => {
    expect((await request(app).delete('/api/auth/me').send(good)).status).toBe(401);
  });

  it('refuses a wrong password and deletes nothing', async () => {
    const m = await makeMatter(student.user.id);
    expect((await erase(student, { password: 'wrong-password-1', confirm: true })).status).toBe(401);
    expect(await count('SELECT count(*)::int AS n FROM users WHERE id = $1', [student.user.id])).toBe(1);
    expect(await count('SELECT count(*)::int AS n FROM matters WHERE id = $1', [m.id])).toBe(1);
  });

  it('keeps the account of a legal expert, who is not erased this way', async () => {
    expect((await erase(expert, good)).status).toBe(403);
    expect(await count('SELECT count(*)::int AS n FROM users WHERE id = $1', [expert.user.id])).toBe(1);
  });
});

describe('erasing the account', () => {
  it('removes the person, their matters, files and questions, and leaves other people alone', async () => {
    const mine = await makeMatter(student.user.id);
    const theirs = await makeMatter(other.user.id);
    expect((await upload(student, mine.id)).status).toBe(201);
    expect((await upload(other, theirs.id)).status).toBe(201);
    await q('INSERT INTO questions (user_id, text) VALUES ($1,$2), ($3,$2)', [student.user.id, 'my question', other.user.id]);

    const res = await erase(student, good);
    expect(res.status).toBe(200);

    expect(await count('SELECT count(*)::int AS n FROM users WHERE id = $1', [student.user.id])).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM matters WHERE user_id = $1', [student.user.id])).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM questions WHERE user_id = $1', [student.user.id])).toBe(0);
    expect(await storedCount()).toBe(1);

    expect(await count('SELECT count(*)::int AS n FROM users WHERE id = $1', [other.user.id])).toBe(1);
    expect(await count('SELECT count(*)::int AS n FROM matters WHERE id = $1', [theirs.id])).toBe(1);
    expect(await count('SELECT count(*)::int AS n FROM questions WHERE user_id = $1', [other.user.id])).toBe(1);
  });

  it('ends the old sign-in', async () => {
    await erase(student, good);
    expect((await request(app).get('/api/auth/me').set('Authorization', student.auth)).status).toBe(401);
  });

  const lawyerProvider = () => makeProvider(
    { name: 'Adv. Amani', category: 'lawyer', type: 'pro_bono_lawyer', bookable: true, user_id: expert.user.id },
    { verifiedBy: expert.user.id });

  it('cancels an open booking and keeps every booking with no name, no account and no topic', async () => {
    const lawyer = await lawyerProvider();
    const make = async (status, days) => (await q(
      `INSERT INTO bookings (user_id, provider_id, slot, topic, status, proposed_slot, proposed_at)
       VALUES ($1,$2, now() + ($3 || ' days')::interval, 'my private topic', $4,
               CASE WHEN $4 = 'requested' THEN now() + interval '9 days' END,
               CASE WHEN $4 = 'requested' THEN now() END) RETURNING id`,
      [student.user.id, lawyer.id, String(days), status]))[0].id;
    const accepted = await make('accepted', 2);
    const requested = await make('requested', 3);
    const completed = await make('completed', 4);
    await q(
      `INSERT INTO booking_reminders (booking_id, recipient, kind, send_at)
       VALUES ($1,'lawyer','day', now() + interval '1 day'), ($1,'lawyer','hour', now() + interval '2 days')`,
      [accepted]);

    expect((await erase(student, good)).status).toBe(200);

    const rows = await q('SELECT id, user_id, anon_token, topic, status, proposed_slot FROM bookings ORDER BY id');
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[accepted]).toMatchObject({ user_id: null, anon_token: null, topic: null, status: 'cancelled' });
    expect(byId[requested]).toMatchObject({ user_id: null, topic: null, status: 'cancelled', proposed_slot: null });
    expect(byId[completed]).toMatchObject({ user_id: null, topic: null, status: 'completed' });
    expect(await count(`SELECT count(*)::int AS n FROM booking_reminders WHERE booking_id = $1 AND status = 'cancelled'`, [accepted])).toBe(2);
  });

  it('tells the lawyer once about an accepted consultation that is erased, and not about a requested one', async () => {
    resetNotifyThrottle();
    const mails = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((text) => { mails.push(String(text)); });
    try {
      const lawyer = await lawyerProvider();
      await q(
        `INSERT INTO bookings (user_id, provider_id, slot, topic, status)
         VALUES ($1,$2, now() + interval '2 days', 'my private topic', 'accepted'),
                ($1,$2, now() + interval '3 days', 'my private topic', 'requested')`,
        [student.user.id, lawyer.id]);

      expect((await erase(student, good)).status).toBe(200);
      await whenSettled();

      const toLawyer = mails.filter((m) => m.includes(`To:      ${expert.user.email}`));
      expect(toLawyer).toHaveLength(1);
      expect(toLawyer[0]).toContain('cancelled by the person who booked it');
      expect(toLawyer[0]).not.toContain('my private topic');
      expect(toLawyer[0]).not.toContain(student.user.name);
      expect(toLawyer[0]).not.toContain(student.user.email);
    } finally {
      spy.mockRestore();
    }
  });

  it('does not count an erased booking as an anonymous one', async () => {
    const lawyer = await lawyerProvider();
    await q(
      `INSERT INTO bookings (user_id, provider_id, slot, status) VALUES ($1,$2, now() + interval '2 days', 'completed')`,
      [student.user.id, lawyer.id]);
    await erase(student, good);
    const admin = await makeUser('admin', 'admin@alustudent.com');
    const res = await request(app).get('/api/admin/stats').set('Authorization', admin.auth);
    expect(res.body.bookings).toMatchObject({ total: 1, anonymous: 0 });
  });

  it('refuses with 409 and changes nothing when the account is linked to records it published', async () => {
    const m = await makeMatter(student.user.id);
    await q("INSERT INTO invite_tokens (token_hash, email, expires_at, created_by) VALUES ($1,$2, now() + interval '1 day', $3)",
      ['h'.repeat(64), 'x@example.org', student.user.id]);
    const res = await erase(student, good);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Your account is linked to records you published. Ask an administrator to switch it off instead.');
    expect(await count('SELECT count(*)::int AS n FROM users WHERE id = $1', [student.user.id])).toBe(1);
    expect(await count('SELECT count(*)::int AS n FROM matters WHERE id = $1', [m.id])).toBe(1);
  });
});

describe('the limit on checking the password for erasing', () => {
  it('stops one account after 10 wrong passwords', async () => {
    process.env.RATE_LIMIT_TEST = '1';
    try {
      // Each attempt names a different address so the per-address login limit does not answer first.
      for (let i = 0; i < 10; i += 1) {
        expect((await erase(student, { password: 'wrong', confirm: true, email: `try${i}@alustudent.com` })).status).toBe(401);
      }
      const blocked = await erase(student, { password: 'wrong', confirm: true, email: 'try10@alustudent.com' });
      expect(blocked.status).toBe(429);
      expect(blocked.body.error).toMatch(/too many attempts/i);
    } finally {
      delete process.env.RATE_LIMIT_TEST;
    }
  });
});

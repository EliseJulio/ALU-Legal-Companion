// A student or staff member erasing their own account: DELETE /api/auth/me.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeMatter, makeProvider } from '../helpers.js';

const PASSWORD = 'password1234'; // what makeUser gives every test account
const PDF = Buffer.from('%PDF-1.4\nsecret\n%%EOF');

let dir;
let student;
let other;
let expert;
beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'erase-docs-')); });
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(async () => {
  process.env.DOCUMENT_KEY = 'ab'.repeat(32);
  process.env.DOCUMENTS_DIR = dir;
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
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
    expect(fs.readdirSync(dir)).toHaveLength(1);

    expect(await count('SELECT count(*)::int AS n FROM users WHERE id = $1', [other.user.id])).toBe(1);
    expect(await count('SELECT count(*)::int AS n FROM matters WHERE id = $1', [theirs.id])).toBe(1);
    expect(await count('SELECT count(*)::int AS n FROM questions WHERE user_id = $1', [other.user.id])).toBe(1);
  });

  it('ends the old sign-in', async () => {
    await erase(student, good);
    expect((await request(app).get('/api/auth/me').set('Authorization', student.auth)).status).toBe(401);
  });

  it('keeps a booking for the lawyer but with no name, no account and no topic', async () => {
    const lawyer = await makeProvider({ name: 'Adv. Amani', category: 'lawyer', type: 'pro_bono_lawyer', bookable: true, user_id: expert.user.id }, { verifiedBy: expert.user.id });
    const [booking] = await q(
      `INSERT INTO bookings (user_id, provider_id, slot, topic, status)
       VALUES ($1,$2, now() + interval '2 days', 'my private topic', 'accepted') RETURNING id`,
      [student.user.id, lawyer.id]);
    await erase(student, good);
    const [row] = await q('SELECT user_id, anon_token, topic, status FROM bookings WHERE id = $1', [booking.id]);
    expect(row).toEqual({ user_id: null, anon_token: null, topic: null, status: 'accepted' });
  });

  it('keeps the account and shows no stack trace when a stored file cannot be removed', async () => {
    const m = await makeMatter(student.user.id);
    await upload(student, m.id);
    const [d] = await q('SELECT stored_name FROM matter_documents WHERE matter_id = $1', [m.id]);
    // A directory under the stored name cannot be removed as a file, so the removal fails.
    fs.rmSync(path.join(dir, d.stored_name), { force: true });
    fs.mkdirSync(path.join(dir, d.stored_name));
    fs.writeFileSync(path.join(dir, d.stored_name, 'x'), 'x');

    const res = await erase(student, good);
    expect(res.status).toBe(500);
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js|stack/i);
    expect(await count('SELECT count(*)::int AS n FROM users WHERE id = $1', [student.user.id])).toBe(1);
  });
});

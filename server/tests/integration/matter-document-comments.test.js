// The lawyer a matter is shared with can comment on its documents. A comment is separate from the
// verdict. A lawyer can ask a question without changing Complete or Needs fixing. Access is exactly
// the access to the matter. Only the lawyer it is shared with at this moment may write. The owner
// reads. Everyone else gets a 404.
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
let strangerOffice;
let matter;
let doc;

beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matter-comments-')); });
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

beforeEach(async () => {
  process.env.DOCUMENT_KEY = 'ef'.repeat(32);
  process.env.DOCUMENTS_DIR = dir;
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
  await resetDb();
  student = await makeUser('student', 'student@alustudent.com');
  other = await makeUser('student', 'other@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
  stranger = await makeUser('legal_expert', 'stranger@example.org');
  const lawyer = await makeProvider({ name: 'Adv. Amani', category: 'lawyer', type: 'pro_bono_lawyer' }, { verifiedBy: expert.user.id });
  await q('UPDATE providers SET user_id = $1 WHERE id = $2', [expert.user.id, lawyer.id]);
  strangerOffice = await makeProvider({ name: 'Adv. Bosco', category: 'lawyer', type: 'pro_bono_lawyer' }, { verifiedBy: stranger.user.id });
  await q('UPDATE providers SET user_id = $1 WHERE id = $2', [stranger.user.id, strangerOffice.id]);

  matter = (await request(app).post('/api/matters').set('Authorization', student.auth).send({ title: 'Buying a car' })).body;
  doc = (await upload('Sale agreement')).body;
  await request(app).post(`/api/matters/${matter.id}/share`).set('Authorization', student.auth).send({ provider_id: lawyer.id }).expect(200);
});

const upload = (label, { replaces } = {}) =>
  request(app).post(`/api/matters/${matter.id}/documents?label=${encodeURIComponent(label)}${replaces ? `&replaces=${replaces}` : ''}`)
    .set('Authorization', student.auth).set('Content-Type', 'application/pdf').send(PDF(label));
const comment = (body, user = expert, docId = doc.id) =>
  request(app).post(`/api/matters/${matter.id}/documents/${docId}/comments`).set('Authorization', user.auth).send({ body });
const list = (user = student) => request(app).get(`/api/matters/${matter.id}/documents`).set('Authorization', user.auth);

describe('writing a comment', () => {
  test('the shared lawyer comments and the owner reads it with the name of the lawyer', async () => {
    const res = await comment('Is the plate number on this page the same as on the yellow card?');
    expect(res.status).toBe(201);
    const seen = (await list()).body[0];
    expect(seen.comments).toHaveLength(1);
    expect(seen.comments[0]).toMatchObject({ body: 'Is the plate number on this page the same as on the yellow card?', author_name: 'Test legal_expert', by_you: false });
  });

  test('a comment does not change the verdict and a lawyer can add several', async () => {
    await comment('First point.');
    await comment('Second point.');
    const seen = (await list()).body[0];
    expect(seen.review.status).toBe('pending');
    expect(seen.comments.map((c) => c.body)).toEqual(['First point.', 'Second point.']);
  });

  test('the lawyer sees their own comments marked as theirs and no name', async () => {
    await comment('Mine.');
    const [c] = (await list(expert)).body[0].comments;
    expect(c).toMatchObject({ body: 'Mine.', by_you: true, author_name: null });
  });

  test('the history of the matter says a comment was made and does not copy what it said', async () => {
    await comment('A private question about the seller.');
    const events = await q('SELECT description, author_id FROM matter_events WHERE matter_id = $1', [matter.id]);
    expect(events.map((e) => e.description)).toContain('Commented on “Sale agreement”');
    expect(events.map((e) => e.description).join(' ')).not.toMatch(/private question/);
    expect(events.find((e) => e.description.startsWith('Commented on')).author_id).toBe(expert.user.id);
  });

  test('refuses an empty comment and one that is too long', async () => {
    expect((await comment('   ')).status).toBe(400);
    expect((await comment('x'.repeat(1001))).status).toBe(400);
    expect((await list()).body[0].comments).toHaveLength(0);
  });

  test('stops at 50 comments on one document', async () => {
    await q(
      `INSERT INTO matter_document_comments (document_id, author_id, body)
       SELECT $1, $2, 'filler ' || g FROM generate_series(1, 50) g`, [doc.id, expert.user.id]);
    const res = await comment('One too many.');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/50 comments/);
  });
});

describe('who may comment and who may read', () => {
  test('the owner cannot comment on their own documents', async () => {
    expect((await comment('Self-comment', student)).status).toBe(404);
  });

  test.each([
    ['another student', () => other],
    ['a lawyer the matter is not shared with', () => stranger],
  ])('%s gets 404 on writing and on reading', async (_name, who) => {
    expect((await comment('Sneaky', who())).status).toBe(404);
    expect((await list(who())).status).toBe(404);
  });

  test('a visitor with no sign-in is refused', async () => {
    const res = await request(app).post(`/api/matters/${matter.id}/documents/${doc.id}/comments`).send({ body: 'Hi' });
    expect(res.status).toBe(401);
  });

  test('a document that is not on this matter is a 404 even for the shared lawyer', async () => {
    const otherMatter = (await request(app).post('/api/matters').set('Authorization', other.auth).send({ title: 'Mine' })).body;
    const foreign = (await request(app).post(`/api/matters/${otherMatter.id}/documents?label=Passport`)
      .set('Authorization', other.auth).set('Content-Type', 'application/pdf').send(PDF('passport'))).body;
    expect((await comment('Wrong matter', expert, foreign.id)).status).toBe(404);
    expect((await comment('No such file', expert, 99999)).status).toBe(404);
  });

  test('when the owner stops sharing the lawyer can no longer read or write', async () => {
    await comment('Before.');
    await request(app).delete(`/api/matters/${matter.id}/share`).set('Authorization', student.auth).expect(200);
    expect((await comment('After.')).status).toBe(404);
    expect((await list(expert)).status).toBe(404);
  });

  test('a different lawyer sharing later sees the comments but never the name of the first lawyer', async () => {
    await comment('From the first lawyer.');
    await request(app).delete(`/api/matters/${matter.id}/share`).set('Authorization', student.auth).expect(200);
    await request(app).post(`/api/matters/${matter.id}/share`).set('Authorization', student.auth)
      .send({ provider_id: strangerOffice.id }).expect(200);
    const [c] = (await list(stranger)).body[0].comments;
    expect(c).toMatchObject({ body: 'From the first lawyer.', author_name: null, by_you: false });
  });
});

describe('a comment belongs to its file', () => {
  test('a replacement file starts with no comments', async () => {
    await comment('About the old file.');
    const replacement = (await upload('Sale agreement', { replaces: doc.id })).body;
    const files = (await list()).body;
    expect(files.find((d) => d.id === replacement.id).comments).toHaveLength(0);
    expect(files.find((d) => d.id === doc.id)).toBeUndefined();
    const [{ n }] = await q('SELECT count(*)::int AS n FROM matter_document_comments WHERE document_id = $1', [replacement.id]);
    expect(n).toBe(0);
  });

  test('deleting a document deletes its comments and only the owner can delete', async () => {
    await comment('Will go.');
    await request(app).delete(`/api/matters/${matter.id}/documents/${doc.id}`).set('Authorization', expert.auth).expect(404);
    const [{ before }] = await q('SELECT count(*)::int AS before FROM matter_document_comments');
    expect(before).toBe(1);
    await request(app).delete(`/api/matters/${matter.id}/documents/${doc.id}`).set('Authorization', student.auth).expect(204);
    const [{ after }] = await q('SELECT count(*)::int AS after FROM matter_document_comments');
    expect(after).toBe(0);
  });
});

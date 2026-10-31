import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { hashAnonToken } from '../../src/services/anonToken.js';
import { resetDb, makeUser } from '../helpers.js';

let student;
let staff;
let expert;
let otherExpert;
let admin;
beforeEach(async () => {
  await resetDb();
  student = await makeUser('student', 'asker.student@alustudent.com');
  staff = await makeUser('staff', 'asker.staff@alueducation.com');
  expert = await makeUser('legal_expert');
  otherExpert = await makeUser('legal_expert', 'other.expert@example.org');
  admin = await makeUser('admin');
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const ask = (who, text) => as(who, 'post', '/api/questions').send({ text });
const askAnon = (text) => request(app).post('/api/questions/anonymous').send({ text });
const answer = (who, id, text) => as(who, 'post', `/api/questions/${id}/answer`).send({ answer: text });

describe('POST /api/questions (signed in)', () => {
  it('lets a student and a staff member ask in their own name', async () => {
    const res = await ask(student, '  Can my landlord enter without telling me?  ');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ text: 'Can my landlord enter without telling me?', status: 'open' });
    expect(res.body).not.toHaveProperty('anon_token');
    expect((await ask(staff, 'Another question')).status).toBe(201);
    const [row] = await q('SELECT user_id, anon_token FROM questions WHERE id = $1', [res.body.id]);
    expect(row).toEqual({ user_id: student.user.id, anon_token: null });
  });

  it('needs a student or staff login', async () => {
    expect((await request(app).post('/api/questions').send({ text: 'x' })).status).toBe(401);
    expect((await ask(expert, 'x')).status).toBe(403);
    expect((await ask(admin, 'x')).status).toBe(403);
  });

  it.each([
    ['no text', undefined],
    ['blank text', '   '],
    ['text that is not text', 42],
    ['text that is too long', 'x'.repeat(5001)],
  ])('refuses %s', async (_label, text) => {
    const res = await ask(student, text);
    expect(res.status).toBe(400);
  });

  it('accepts the longest allowed text', async () => {
    expect((await ask(student, 'x'.repeat(5000))).status).toBe(201);
  });
});

describe('POST /api/questions/anonymous', () => {
  it('stores no identity and returns a token once with a warning', async () => {
    const res = await askAnon('Is my supervisor allowed to do this?');
    expect(res.status).toBe(201);
    expect(res.body.anon_token).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(res.body.warning).toMatch(/cannot be recovered/);
    expect(res.body).not.toHaveProperty('user_id');
    const [row] = await q('SELECT user_id, anon_token FROM questions');
    expect(row).toEqual({ user_id: null, anon_token: hashAnonToken(res.body.anon_token) });
    expect(row.anon_token).not.toBe(res.body.anon_token);
  });

  it('stays anonymous even when the caller is signed in', async () => {
    const res = await request(app).post('/api/questions/anonymous')
      .set('Authorization', student.auth).send({ text: 'A private question' });
    expect(res.status).toBe(201);
    const [row] = await q('SELECT user_id FROM questions');
    expect(row.user_id).toBeNull();
  });

  it('applies the same checks on the text', async () => {
    expect((await askAnon('')).status).toBe(400);
    expect((await askAnon('x'.repeat(5001))).status).toBe(400);
    expect((await request(app).post('/api/questions/anonymous').send({})).status).toBe(400);
  });
});

describe('reading my own questions', () => {
  it('shows a signed-in person only their own, newest first', async () => {
    await ask(student, 'First');
    await ask(student, 'Second');
    await ask(staff, 'Not mine');
    const res = await as(student, 'get', '/api/questions/mine');
    expect(res.body.map((x) => x.text)).toEqual(['Second', 'First']);
    expect(Object.keys(res.body[0]).sort()).toEqual(['answer', 'created_at', 'id', 'status', 'text']);
  });

  it('needs a student or staff login', async () => {
    expect((await request(app).get('/api/questions/mine')).status).toBe(401);
    expect((await as(expert, 'get', '/api/questions/mine')).status).toBe(403);
  });

  it('finds an anonymous question by its token whatever the case and spacing', async () => {
    const { body } = await askAnon('Where do I go?');
    for (const typed of [body.anon_token, body.anon_token.toLowerCase(), body.anon_token.replaceAll('-', ''), `%20${body.anon_token}%20`]) {
      const res = await request(app).get(`/api/questions/anon/${typed}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ text: 'Where do I go?', status: 'open', answer: null });
      expect(res.body).not.toHaveProperty('anon_token');
    }
  });

  it('answers 404 for an unknown token and for text that cannot be a token', async () => {
    for (const bad of ['1234-5678-9ABC-DEF0', 'short', 'AAAA-BBBB-CCCC']) {
      const res = await request(app).get(`/api/questions/anon/${bad}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No question found/);
    }
  });
});

describe('the inbox of the legal experts', () => {
  it('shows open questions oldest first and says only whether they are anonymous', async () => {
    await ask(student, 'Signed-in question');
    await askAnon('Anonymous question');
    const res = await as(expert, 'get', '/api/questions/open');
    expect(res.status).toBe(200);
    expect(res.body.map((x) => [x.text, x.kind])).toEqual([
      ['Signed-in question', 'signed-in'], ['Anonymous question', 'anonymous']]);
    expect(Object.keys(res.body[0]).sort()).toEqual(['created_at', 'id', 'kind', 'text']);
  });

  it('never shows who asked', async () => {
    await ask(student, 'Signed-in question');
    const anon = await askAnon('Anonymous question');
    const text = JSON.stringify((await as(expert, 'get', '/api/questions/open')).body);
    expect(text).not.toContain('asker.student@alustudent.com');
    expect(text).not.toContain('Test student');
    expect(text).not.toContain(anon.body.anon_token.slice(0, 4));
    expect(text).not.toContain(hashAnonToken(anon.body.anon_token).slice(0, 8));
  });

  it('is for legal experts only', async () => {
    expect((await request(app).get('/api/questions/open')).status).toBe(401);
    expect((await as(student, 'get', '/api/questions/open')).status).toBe(403);
    expect((await as(admin, 'get', '/api/questions/open')).status).toBe(403);
  });
});

describe('POST /api/questions/:id/answer', () => {
  it('lets an expert answer and the person read it', async () => {
    const mine = await ask(student, 'A signed-in question');
    const anon = await askAnon('An anonymous question');
    expect((await answer(expert, mine.body.id, 'Go to the labour inspector.')).body).toMatchObject({ status: 'answered' });
    expect((await answer(expert, anon.body.id, 'Go to the Abunzi committee.')).status).toBe(200);

    const own = (await as(student, 'get', '/api/questions/mine')).body[0];
    expect(own).toMatchObject({ status: 'answered', answer: 'Go to the labour inspector.' });
    const viaToken = await request(app).get(`/api/questions/anon/${anon.body.anon_token}`);
    expect(viaToken.body).toMatchObject({ status: 'answered', answer: 'Go to the Abunzi committee.' });
  });

  it('records which expert answered', async () => {
    const created = await ask(student, 'A question');
    await answer(expert, created.body.id, 'An answer.');
    const [row] = await q('SELECT answered_by FROM questions WHERE id = $1', [created.body.id]);
    expect(row.answered_by).toBe(expert.user.id);
  });

  it('takes an answered question out of the inbox', async () => {
    const created = await ask(student, 'A question');
    await answer(expert, created.body.id, 'An answer.');
    expect((await as(expert, 'get', '/api/questions/open')).body).toEqual([]);
  });

  it('lets only one of two experts answer the same question', async () => {
    const created = await ask(student, 'A question');
    const results = await Promise.all([
      answer(expert, created.body.id, 'First answer.'),
      answer(otherExpert, created.body.id, 'Second answer.'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 404]);
  });

  it('refuses a second answer and keeps the first', async () => {
    const created = await ask(student, 'A question');
    await answer(expert, created.body.id, 'First answer.');
    const again = await answer(otherExpert, created.body.id, 'Second answer.');
    expect(again.status).toBe(404);
    expect(again.body.error).toMatch(/already answered/);
    const [row] = await q('SELECT answer FROM questions WHERE id = $1', [created.body.id]);
    expect(row.answer).toBe('First answer.');
  });

  it('needs an answer of reasonable length', async () => {
    const created = await ask(student, 'A question');
    expect((await answer(expert, created.body.id, '   ')).status).toBe(400);
    expect((await answer(expert, created.body.id, 'x'.repeat(10001))).status).toBe(400);
    expect((await as(expert, 'post', `/api/questions/${created.body.id}/answer`).send({})).status).toBe(400);
  });

  it('is for legal experts only and answers 404 for an unknown question', async () => {
    const created = await ask(student, 'A question');
    expect((await request(app).post(`/api/questions/${created.body.id}/answer`).send({ answer: 'x' })).status).toBe(401);
    expect((await answer(student, created.body.id, 'x')).status).toBe(403);
    expect((await answer(admin, created.body.id, 'x')).status).toBe(403);
    expect((await answer(expert, 99999, 'x')).status).toBe(404);
    expect((await answer(expert, 'abc', 'x')).status).toBe(404);
  });
});

describe('the database rules for questions', () => {
  it('refuses a question with both an account and a token', async () => {
    await expect(q(`INSERT INTO questions (user_id, anon_token, text) VALUES ($1,'abc','text')`, [student.user.id]))
      .rejects.toThrow(/questions_check/);
  });

  it('refuses a question with neither', async () => {
    await expect(q(`INSERT INTO questions (text) VALUES ('text')`)).rejects.toThrow(/questions_check/);
  });

  it('never stores the same token twice', async () => {
    await q(`INSERT INTO questions (anon_token, text) VALUES ('same', 'one')`);
    await expect(q(`INSERT INTO questions (anon_token, text) VALUES ('same', 'two')`))
      .rejects.toThrow(/questions_anon_token_key/);
  });

  it('refuses an answered question with no answer', async () => {
    await expect(q(`INSERT INTO questions (user_id, text, status) VALUES ($1,'text','answered')`, [student.user.id]))
      .rejects.toThrow(/questions_check/);
  });

  it('allows many signed-in questions that have no token', async () => {
    await ask(student, 'One');
    await ask(student, 'Two');
    const [{ n }] = await q('SELECT count(*)::int AS n FROM questions');
    expect(n).toBe(2);
  });
});

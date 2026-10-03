// Questions for legal experts, and the anonymity rule.
// An anonymous question stores a token and no identity and only the token can read the answer.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser } from '../helpers.js';

let student, expert;

beforeEach(async () => {
  await resetDb();
  student = await makeUser('student', 'student.q@alustudent.com');
  expert = await makeUser('legal_expert', 'expert.q@example.org');
});

const ask = (text, user) => {
  const req = request(app).post('/api/questions');
  return (user ? req.set('Authorization', user.auth) : req).send({ text });
};

describe('anonymous questions', () => {
  test('submit, expert answers, readable by token only', async () => {
    const asked = await ask('Can my landlord keep my deposit?');
    expect(asked.status).toBe(201);
    const token = asked.body.anon_token;
    expect(token).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(asked.body.warning).toMatch(/only way/i);

    const [row] = await q('SELECT * FROM questions WHERE anon_token = $1', [token]);
    expect(row.user_id).toBeNull();

    const inbox = await request(app).get('/api/questions/open').set('Authorization', expert.auth);
    expect(inbox.body).toHaveLength(1);
    expect(inbox.body[0].kind).toBe('anonymous');
    expect(inbox.body[0]).not.toHaveProperty('anon_token');

    const answered = await request(app)
      .post(`/api/questions/${inbox.body[0].id}/answer`).set('Authorization', expert.auth)
      .send({ answer: 'Only for documented damage.' });
    expect(answered.status).toBe(200);

    const read = await request(app).get(`/api/questions/anon/${token}`);
    expect(read.body.status).toBe('answered');
    expect(read.body.answer).toMatch(/documented damage/);
    expect(read.body).not.toHaveProperty('anon_token');
  });

  test('a wrong token finds nothing', async () => {
    expect((await request(app).get('/api/questions/anon/AAAA-BBBB-CCCC')).status).toBe(404);
  });

  test('an anonymous question never appears in a signed-in user’s own list', async () => {
    await ask('Anonymous one');
    const mine = await request(app).get('/api/questions/mine').set('Authorization', student.auth);
    expect(mine.body).toEqual([]);
  });

  test('two questions get different tokens', async () => {
    const first = await ask('First anonymous question');
    const second = await ask('Second anonymous question');
    expect(second.body.anon_token).not.toBe(first.body.anon_token);
  });

  test('the database refuses a repeated token', async () => {
    await q(`INSERT INTO questions (anon_token, text) VALUES ($1, $2)`, ['DUPE-TOKN-0001', 'First']);
    await expect(
      q(`INSERT INTO questions (anon_token, text) VALUES ($1, $2)`, ['DUPE-TOKN-0001', 'Second']),
    ).rejects.toMatchObject({ code: '23505' }); // unique violation
  });

  test('the database refuses a question with neither a user nor a token', async () => {
    await expect(q(`INSERT INTO questions (text) VALUES ('nobody')`)).rejects.toThrow(/questions_check/);
  });
});

describe('signed-in questions', () => {
  test('are linked to the user, carry no token, and show in the user’s own list', async () => {
    const asked = await ask('My question', student);
    expect(asked.status).toBe(201);
    expect(asked.body.anon_token).toBeUndefined();

    const [row] = await q('SELECT * FROM questions WHERE id = $1', [asked.body.id]);
    expect(row.user_id).toBe(student.user.id);
    expect(row.anon_token).toBeNull();

    const mine = await request(app).get('/api/questions/mine').set('Authorization', student.auth);
    expect(mine.body.map((x) => x.text)).toEqual(['My question']);
    const inbox = await request(app).get('/api/questions/open').set('Authorization', expert.auth);
    expect(inbox.body[0].kind).toBe('signed-in');
  });

  test('a session that has ended asks as a visitor, and is neither linked to the account nor refused', async () => {
    await request(app).post('/api/auth/logout').set('Authorization', student.auth);
    const asked = await ask('After sign out', student);
    expect(asked.status).toBe(201);
    expect(asked.body.anon_token).toBeTruthy();
    const [row] = await q('SELECT user_id FROM questions WHERE id = $1', [asked.body.id]);
    expect(row.user_id).toBeNull();
  });

  test('empty text is refused', async () => {
    expect((await ask('   ')).status).toBe(400);
    expect((await ask('', student)).status).toBe(400);
  });
});

describe('the expert inbox', () => {
  test('only a legal expert can read it or answer', async () => {
    const asked = await ask('A question', student);
    expect((await request(app).get('/api/questions/open')).status).toBe(401);
    expect((await request(app).get('/api/questions/open').set('Authorization', student.auth)).status).toBe(403);
    const res = await request(app).post(`/api/questions/${asked.body.id}/answer`)
      .set('Authorization', student.auth).send({ answer: 'x' });
    expect(res.status).toBe(403);
  });

  test('the first answer wins and a second attempt gets a 404', async () => {
    const asked = await ask('A question', student);
    const answer = (text) => request(app).post(`/api/questions/${asked.body.id}/answer`)
      .set('Authorization', expert.auth).send({ answer: text });
    expect((await answer('First')).status).toBe(200);
    expect((await answer('Second')).status).toBe(404);
    const [row] = await q('SELECT answer, answered_by FROM questions WHERE id = $1', [asked.body.id]);
    expect(row).toEqual({ answer: 'First', answered_by: expert.user.id });
  });

  test('an empty answer is refused, and a bad id is a 404', async () => {
    const asked = await ask('A question', student);
    const empty = await request(app).post(`/api/questions/${asked.body.id}/answer`)
      .set('Authorization', expert.auth).send({ answer: ' ' });
    expect(empty.status).toBe(400);
    const bad = await request(app).post('/api/questions/abc/answer')
      .set('Authorization', expert.auth).send({ answer: 'x' });
    expect(bad.status).toBe(404);
  });
});

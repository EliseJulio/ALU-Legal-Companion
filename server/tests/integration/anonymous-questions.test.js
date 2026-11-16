import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { hashAnonToken } from '../../src/services/anonToken.js';
import { resetDb, makeUser } from '../helpers.js';

let student;
beforeEach(async () => {
  await resetDb();
  student = await makeUser('student', 'asker.student@alustudent.com');
});

const askAnon = (text, headers = {}) => request(app).post('/api/questions/anonymous').set(headers).send({ text });

describe('asking a question without giving a name', () => {
  it('stores no account and gives back a code once, with a warning', async () => {
    const res = await askAnon('Is my supervisor allowed to do this?');
    expect(res.status).toBe(201);
    expect(res.body.anon_token).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(res.body.warning).toMatch(/cannot be recovered/);
    expect(res.body).not.toHaveProperty('user_id');
    const [row] = await q('SELECT user_id FROM questions');
    expect(row.user_id).toBeNull();
  });

  it('keeps only a hash of the code, so the database cannot give it back', async () => {
    const { body } = await askAnon('A private question');
    const [row] = await q('SELECT anon_token FROM questions');
    expect(row.anon_token).toBe(hashAnonToken(body.anon_token));
    expect(row.anon_token).not.toContain(body.anon_token.slice(0, 4));
  });

  it('stays anonymous even when the person is signed in', async () => {
    const res = await askAnon('A private question', { Authorization: student.auth });
    expect(res.status).toBe(201);
    expect((await q('SELECT user_id FROM questions'))[0].user_id).toBeNull();
  });

  it('refuses an empty question and one that is too long', async () => {
    expect((await askAnon('')).status).toBe(400);
    expect((await askAnon('x'.repeat(5001))).status).toBe(400);
  });
});

describe('getting the answer back with the code', () => {
  it('finds the question with the code, whatever the letter case or the dashes', async () => {
    const { body } = await askAnon('Where do I go?');
    for (const typed of [body.anon_token, body.anon_token.toLowerCase(), body.anon_token.replaceAll('-', '')]) {
      const res = await request(app).get(`/api/questions/anon/${typed}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ text: 'Where do I go?', status: 'open' });
      expect(res.body).not.toHaveProperty('anon_token');
    }
  });

  it('answers 404 for a code that was never given', async () => {
    const res = await request(app).get('/api/questions/anon/1234-5678-9ABC-DEF0');
    expect(res.status).toBe(404);
  });
});

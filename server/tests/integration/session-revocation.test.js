// A session must be able to end. A login token is valid for 7 days and cannot be taken back,
// so the server keeps a counter on the account (session_version). Signing out, or resetting
// a password, adds 1 to it, and every older token stops working.
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app.js';
import { resetDb, makeUser } from '../helpers.js';
import { issueToken } from '../../src/services/authTokens.js';
import { getSecret } from '../../src/middleware/auth.js';

let student;
let other;

beforeEach(async () => {
  await resetDb();
  student = await makeUser('student', 'student.rev@alustudent.com');
  other = await makeUser('student', 'other.rev@alustudent.com');
});

// A simple request that needs a login, to check whether a token still works.
const me = (auth) => request(app).get('/api/auth/me').set('Authorization', auth);

describe('POST /api/auth/logout', () => {
  test('needs a session to end one', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(401);
  });

  test('makes the token that called it stop working', async () => {
    expect((await me(student.auth)).status).toBe(200);

    const out = await request(app).post('/api/auth/logout').set('Authorization', student.auth);
    expect(out.status).toBe(204);

    expect((await me(student.auth)).status).toBe(401);
  });

  test('lets the same person sign in again straight away', async () => {
    await request(app).post('/api/auth/logout').set('Authorization', student.auth);

    const login = await request(app).post('/api/auth/login')
      .send({ email: 'student.rev@alustudent.com', password: 'password1234' });
    expect(login.status).toBe(200);
    expect((await me(`Bearer ${login.body.token}`)).status).toBe(200);
  });

  test('ends every session of the account, not just the one that asked', async () => {
    // Someone signing out on a shared computer cannot list their other sessions,
    // so all of them are ended.
    const second = await request(app).post('/api/auth/login')
      .send({ email: 'student.rev@alustudent.com', password: 'password1234' });
    const secondAuth = `Bearer ${second.body.token}`;
    expect((await me(secondAuth)).status).toBe(200);

    await request(app).post('/api/auth/logout').set('Authorization', student.auth);

    expect((await me(student.auth)).status).toBe(401);
    expect((await me(secondAuth)).status).toBe(401);
  });

  test('does not end other people\'s sessions', async () => {
    await request(app).post('/api/auth/logout').set('Authorization', student.auth);
    expect((await me(other.auth)).status).toBe(200);
  });
});

describe('tokens that do not match the account', () => {
  test('a token with no session counter is refused', async () => {
    const old = jwt.sign({ id: student.user.id, role: 'student', name: 'x' }, getSecret(), { expiresIn: '7d' });
    expect((await me(`Bearer ${old}`)).status).toBe(401);
  });
});

describe('resetting a password ends every existing session', () => {
  test('a session that was open before the reset stops working', async () => {
    // A reset is what someone does when they think their account is taken over.
    // Leaving the other person signed in would make the reset pointless.
    expect((await me(student.auth)).status).toBe(200);

    const raw = await issueToken(student.user.id, 'reset_password', 1);
    const reset = await request(app).post('/api/auth/reset-password')
      .send({ token: raw, password: 'a-brand-new-password' });
    expect(reset.status).toBe(200);

    expect((await me(student.auth)).status).toBe(401);
    // The person who reset stays signed in, with the new token.
    expect((await me(`Bearer ${reset.body.token}`)).status).toBe(200);
  });
});

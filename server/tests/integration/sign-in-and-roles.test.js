import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { getSecret } from '../../src/middleware/auth.js';
import { resetDb, makeUser } from '../helpers.js';

const PASSWORD = 'a-test-password-1';
const EMAIL = 'test.person@alustudent.com';

// In development the server prints each email. This collects them so a test can read the link.
let mails;
beforeEach(async () => {
  await resetDb();
  mails = [];
  jest.spyOn(console, 'log').mockImplementation((text) => { mails.push(String(text)); });
});
afterEach(() => { jest.restoreAllMocks(); });

const linkToken = () => {
  const match = /[?&]token=([^\s&]+)/.exec(mails[mails.length - 1] || '');
  return match ? decodeURIComponent(match[1]) : null;
};
const register = (overrides = {}) => request(app).post('/api/auth/register')
  .send({ name: 'Test Person', email: EMAIL, password: PASSWORD, role: 'student', ...overrides });
const login = (email = EMAIL, password = PASSWORD) => request(app).post('/api/auth/login').send({ email, password });
const verify = () => request(app).post('/api/auth/verify-email').send({ token: linkToken() });
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('signing up', () => {
  it('makes an unverified account, keeps no plain password and returns no token', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    const [row] = await q('SELECT email_verified_at, password_hash FROM users');
    expect(row.email_verified_at).toBeNull();
    expect(row.password_hash).not.toContain(PASSWORD);
    expect(linkToken()).toBeTruthy();
  });

  it('refuses an address outside the ALU domains', async () => {
    const res = await register({ email: 'someone@gmail.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ALU community/i);
  });

  it('will not let anyone sign up as a legal expert or an admin', async () => {
    for (const role of ['legal_expert', 'admin']) {
      expect((await register({ role })).status).toBe(400);
    }
  });

  it('verifies the address from the emailed link and then signs the person in', async () => {
    await register();
    const res = await verify();
    expect(res.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set(bearer(res.body.token));
    expect(me.status).toBe(200);
  });

  it('refuses an emailed link that was already used', async () => {
    await register();
    const token = linkToken();
    await request(app).post('/api/auth/verify-email').send({ token });
    const again = await request(app).post('/api/auth/verify-email').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error).toMatch(/already been used/i);
  });
});

describe('signing in and out', () => {
  it('keeps an unverified account out until the link is used', async () => {
    await register();
    expect((await login()).status).toBe(403);
    await verify();
    expect((await login()).status).toBe(200);
  });

  it('answers the same for a wrong password and an unknown address', async () => {
    await makeUser('student', 'real@alustudent.com');
    const wrong = await login('real@alustudent.com', 'not-the-password');
    const unknown = await login('nobody@alustudent.com', 'not-the-password');
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('refuses a switched-off account even with the right password', async () => {
    await register();
    await verify();
    await q('UPDATE users SET deactivated_at = now()');
    expect((await login()).status).toBe(403);
  });

  it('never returns the password hash', async () => {
    await register();
    await verify();
    expect(JSON.stringify((await login()).body)).not.toMatch(/password|hash|session_version/i);
  });

  it('signing out ends the token and every other token the account holds', async () => {
    const { auth } = await makeUser('student', 'out@alustudent.com');
    const other = (await login('out@alustudent.com', 'password1234')).body.token;
    expect((await request(app).post('/api/auth/logout').set('Authorization', auth)).status).toBe(204);
    expect((await request(app).get('/api/auth/me').set('Authorization', auth)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(bearer(other))).status).toBe(401);
  });

  it('stops someone guessing the current password from a stolen sign-in', async () => {
    const { auth } = await makeUser('student', 'guess@alustudent.com');
    const guess = () => request(app).post('/api/auth/change-password').set('Authorization', auth)
      .send({ current_password: 'not-the-password', new_password: 'another-password-1' });
    process.env.RATE_LIMIT_TEST = '1';
    try {
      for (let i = 0; i < 10; i += 1) expect((await guess()).status).toBe(400);
      expect((await guess()).status).toBe(429);
    } finally {
      delete process.env.RATE_LIMIT_TEST;
    }
  });
});

describe('refusing a request without a valid token', () => {
  it('asks for a login when there is no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Login required' });
  });

  it('refuses a token signed with a different secret', async () => {
    const { user } = await makeUser('student');
    const forged = jwt.sign({ id: user.id, role: 'admin', sv: 0 }, 'a-different-secret-that-is-long-enough-123');
    expect((await request(app).get('/api/auth/me').set(bearer(forged))).status).toBe(401);
  });

  it('refuses an expired token', async () => {
    const { user } = await makeUser('student');
    const old = jwt.sign({ id: user.id, role: 'student', sv: 0 }, getSecret(), { expiresIn: -10 });
    expect((await request(app).get('/api/auth/me').set(bearer(old))).status).toBe(401);
  });
});

describe('roles', () => {
  const adminOnly = (who) => request(app).get('/api/guides/all').set('Authorization', who.auth);

  it.each(['student', 'staff', 'legal_expert'])('keeps a %s out of the admin pages', async (role) => {
    expect((await adminOnly(await makeUser(role, `${role}@example.org`))).status).toBe(403);
  });

  it('lets an admin in', async () => {
    expect((await adminOnly(await makeUser('admin'))).status).toBe(200);
  });

  it('reads the role from the account and not from the token', async () => {
    const who = await makeUser('student');
    expect((await adminOnly(who)).status).toBe(403);
    await q("UPDATE users SET role = 'admin' WHERE id = $1", [who.user.id]);
    expect((await adminOnly(who)).status).toBe(200);
  });
});

import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser } from '../helpers.js';

const PASSWORD = 'a-test-password-1';

// The server prints each email in dev mode. This collects them so a test can read the link.
let mails;
beforeEach(async () => {
  await resetDb();
  mails = [];
  jest.spyOn(console, 'log').mockImplementation((text) => { mails.push(String(text)); });
});
afterEach(() => { jest.restoreAllMocks(); });

const tokenFromLastMail = () => {
  const match = /[?&]token=([^\s&]+)/.exec(mails[mails.length - 1] || '');
  return match ? decodeURIComponent(match[1]) : null;
};

const register = (overrides = {}) => request(app).post('/api/auth/register').send({
  name: 'Test Person', email: 'test.person@alustudent.com', password: PASSWORD, role: 'student', ...overrides,
});
const login = (email = 'test.person@alustudent.com', password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password });

describe('POST /api/auth/register', () => {
  it('creates an unverified account, sends a link and returns no token', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toEqual({ id: expect.any(Number), name: 'Test Person', email: 'test.person@alustudent.com', role: 'student' });

    const [row] = await q('SELECT email_verified_at, password_hash FROM users');
    expect(row.email_verified_at).toBeNull();
    expect(row.password_hash).not.toContain(PASSWORD);
    expect(tokenFromLastMail()).toBeTruthy();
  });

  it('tells the truth when no mail is set up', async () => {
    const res = await register();
    expect(res.body.message).toMatch(/no mail set up/i);
    expect(res.body.message).not.toMatch(/check .* for a link/i);
  });

  it('writes the email in lower case', async () => {
    await register({ email: '  Test.Person@AluStudent.com ' });
    const [row] = await q('SELECT email FROM users');
    expect(row.email).toBe('test.person@alustudent.com');
  });

  it('refuses missing fields', async () => {
    for (const field of ['name', 'email', 'password', 'role']) {
      const res = await register({ [field]: '' });
      expect(res.status).toBe(400);
    }
  });

  it('refuses a role that is not student or staff', async () => {
    for (const role of ['legal_expert', 'admin']) {
      const res = await register({ role });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/student or staff/i);
    }
  });

  it('refuses an address outside the ALU domains', async () => {
    const res = await register({ email: 'someone@gmail.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ALU community/i);
  });

  it('refuses a short password and a password that is not text', async () => {
    expect((await register({ password: 'short' })).status).toBe(400);
    expect((await register({ password: 12345678 })).status).toBe(400);
  });

  it('refuses an address that already has an account', async () => {
    await register();
    const again = await register({ name: 'Someone Else' });
    expect(again.status).toBe(400);
    expect(again.body.error).toMatch(/already exists/i);
  });
});

describe('POST /api/auth/verify-email', () => {
  it('uses the link, verifies the address and signs the person in', async () => {
    await register();
    const res = await request(app).post('/api/auth/verify-email').send({ token: tokenFromLastMail() });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test.person@alustudent.com');

    const [row] = await q('SELECT email_verified_at FROM users');
    expect(row.email_verified_at).not.toBeNull();

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
  });

  it('says a link was already used', async () => {
    await register();
    const token = tokenFromLastMail();
    await request(app).post('/api/auth/verify-email').send({ token });
    const second = await request(app).post('/api/auth/verify-email').send({ token });
    expect(second.status).toBe(400);
    expect(second.body.error).toMatch(/already been used/i);
  });

  it('says a link expired', async () => {
    await register();
    await q("UPDATE auth_tokens SET expires_at = now() - interval '1 minute'");
    const res = await request(app).post('/api/auth/verify-email').send({ token: tokenFromLastMail() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('refuses a made-up token and a missing token', async () => {
    const bad = await request(app).post('/api/auth/verify-email').send({ token: 'made-up' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/not valid/i);
    expect((await request(app).post('/api/auth/verify-email').send({})).status).toBe(400);
  });

  it('gives no token to an account that was switched off before it verified', async () => {
    await register();
    const token = tokenFromLastMail();
    await q('UPDATE users SET deactivated_at = now()');
    const res = await request(app).post('/api/auth/verify-email').send({ token });
    expect(res.status).toBe(403);
    expect(res.body.token).toBeUndefined();
    expect(res.body.error).toMatch(/no longer active/i);
  });

  it('keeps the first time the address was proved', async () => {
    await register();
    const first = tokenFromLastMail();
    await request(app).post('/api/auth/resend-verification').send({ email: 'test.person@alustudent.com' });
    const second = tokenFromLastMail();
    await request(app).post('/api/auth/verify-email').send({ token: first });
    const [{ email_verified_at: before }] = await q('SELECT email_verified_at FROM users');
    await request(app).post('/api/auth/verify-email').send({ token: second });
    const [{ email_verified_at: after }] = await q('SELECT email_verified_at FROM users');
    expect(after).toEqual(before);
  });
});

describe('POST /api/auth/resend-verification', () => {
  const resend = (email) => request(app).post('/api/auth/resend-verification').send({ email });

  it('gives the same answer for every address', async () => {
    await register();
    await makeUser('student', 'verified@alustudent.com');
    const unverified = await resend('test.person@alustudent.com');
    const verified = await resend('verified@alustudent.com');
    const unknown = await resend('nobody@alustudent.com');
    expect(unverified.status).toBe(200);
    expect(verified.body).toEqual(unverified.body);
    expect(unknown.body).toEqual(unverified.body);
    expect(unknown.status).toBe(unverified.status);
  });

  it('sends a link only to an account that is not verified yet', async () => {
    await register();
    await makeUser('student', 'verified@alustudent.com');
    const before = mails.length;
    await resend('verified@alustudent.com');
    await resend('nobody@alustudent.com');
    expect(mails.length).toBe(before);
    await resend('test.person@alustudent.com');
    expect(mails.length).toBe(before + 1);
  });

  it('sends nothing to a switched-off account and still gives the same answer', async () => {
    await register();
    await q('UPDATE users SET deactivated_at = now()');
    const before = mails.length;
    const res = await resend('test.person@alustudent.com');
    const unknown = await resend('nobody@alustudent.com');
    expect(mails.length).toBe(before);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(unknown.body);
  });

  it('refuses a request with no email', async () => {
    expect((await request(app).post('/api/auth/resend-verification').send({})).status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('keeps an unverified account out and lets it in after the link is used', async () => {
    await register();
    const blocked = await login();
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toMatch(/not verified/i);

    await request(app).post('/api/auth/verify-email').send({ token: tokenFromLastMail() });
    const ok = await login();
    expect(ok.status).toBe(200);
    expect(ok.body.token).toEqual(expect.any(String));
    expect(ok.body.user).toEqual({ id: expect.any(Number), name: 'Test Person', email: 'test.person@alustudent.com', role: 'student' });
  });

  it('answers the same for a wrong password and an unknown address', async () => {
    await makeUser('student', 'real@alustudent.com');
    const wrong = await login('real@alustudent.com', 'not-the-password');
    const unknown = await login('nobody@alustudent.com', 'not-the-password');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('does not say an account is unverified to someone with the wrong password', async () => {
    await register();
    const res = await login('test.person@alustudent.com', 'not-the-password');
    expect(res.status).toBe(401);
  });

  it('does not say an account is switched off to someone with the wrong password', async () => {
    const { user } = await makeUser('student', 'off@alustudent.com');
    await q('UPDATE users SET deactivated_at = now() WHERE id = $1', [user.id]);
    const wrong = await login('off@alustudent.com', 'not-the-password');
    expect(wrong.status).toBe(401);
  });

  it('refuses a switched-off account that has the right password', async () => {
    await register();
    await request(app).post('/api/auth/verify-email').send({ token: tokenFromLastMail() });
    await q('UPDATE users SET deactivated_at = now()');
    const res = await login();
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/no longer active/i);
  });

  it('accepts the email in any letter case', async () => {
    await register();
    await request(app).post('/api/auth/verify-email').send({ token: tokenFromLastMail() });
    expect((await login('  TEST.Person@alustudent.COM ')).status).toBe(200);
  });

  it('never returns the password hash', async () => {
    await register();
    await request(app).post('/api/auth/verify-email').send({ token: tokenFromLastMail() });
    const res = await login();
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|session_version/i);
  });

  it('refuses a request with a missing field', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: 'a@alustudent.com' })).status).toBe(400);
    expect((await request(app).post('/api/auth/login').send({ password: PASSWORD })).status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('needs a login', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it('returns the account and never the hash', async () => {
    const { auth, user } = await makeUser('staff', 'staff.person@alueducation.com');
    const res = await request(app).get('/api/auth/me').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, email: 'staff.person@alueducation.com', role: 'staff' });
    expect(res.body.email_verified_at).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|session_version/i);
  });
});

describe('POST /api/auth/logout', () => {
  it('needs a login', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(401);
  });

  it('ends the token it was called with and every other token the account holds', async () => {
    const { auth, user } = await makeUser('student', 'out@alustudent.com');
    const sameAccount = `Bearer ${(await request(app).post('/api/auth/login').send({ email: 'out@alustudent.com', password: 'password1234' })).body.token}`;
    expect((await request(app).get('/api/auth/me').set('Authorization', sameAccount)).status).toBe(200);

    const res = await request(app).post('/api/auth/logout').set('Authorization', auth);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    expect((await request(app).get('/api/auth/me').set('Authorization', auth)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', sameAccount)).status).toBe(401);

    const [row] = await q('SELECT session_version FROM users WHERE id = $1', [user.id]);
    expect(row.session_version).toBe(1);
  });

  it('lets the person sign in again afterwards', async () => {
    const { auth } = await makeUser('student', 'again@alustudent.com');
    await request(app).post('/api/auth/logout').set('Authorization', auth);
    const res = await request(app).post('/api/auth/login').send({ email: 'again@alustudent.com', password: 'password1234' });
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200);
  });
});

import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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

  it('verifies the address from the emailed link without signing the person in', async () => {
    await register();
    const res = await verify();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ verified: true, message: expect.any(String) });
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toBeUndefined();
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
    const blocked = await login();
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('not_verified');
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
    const res = await login();
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('deactivated');
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

describe('sign-in takes as long for an unknown address as for a wrong password', () => {
  it('still checks the password against a hash when there is no account', async () => {
    const compare = jest.spyOn(bcrypt, 'compare');
    const res = await login('nobody@alustudent.com', 'whatever-it-is');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Incorrect email or password');
    expect(compare).toHaveBeenCalledTimes(1);
  });
});

describe('sign-up input', () => {
  it('answers email_taken and not 500 when two sign-ups for one address arrive together', async () => {
    const [a, b] = await Promise.all([register(), register()]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    const refused = a.status === 400 ? a : b;
    expect(refused.body.code).toBe('email_taken');
  });

  it.each([
    ['a very long address', `${'a'.repeat(300)}@alustudent.com`],
    ['an address with a space', 'a b@alustudent.com'],
    ['an address with a comma', 'a,b@alustudent.com'],
    ['an address with a control character', 'a\u0001b@alustudent.com'],
  ])('refuses %s with 400', async (_label, email) => {
    expect((await register({ email })).status).toBe(400);
  });

  it('refuses a NUL character anywhere in a JSON body with 400', async () => {
    const res = await register({ name: 'Test\u0000Person' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
    expect((await q('SELECT 1 FROM users')).length).toBe(0);
  });

  it('answers a request with an unsupported encoding with 415 and not 500', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/auth/login')
      .set('Content-Type', 'application/json').set('Content-Encoding', 'br').send('{"a":1}');
    expect(res.status).toBe(415);
    expect(Object.keys(res.body)).toEqual(['error']);
  });
});

describe('the email limits do not share one budget', () => {
  it('lets a person reset a password after others asked for a link on the same address', async () => {
    process.env.RATE_LIMIT_TEST = '1';
    try {
      const body = { email: 'victim.limit@alustudent.com' };
      for (let i = 0; i < 5; i += 1) {
        expect((await request(app).post('/api/auth/resend-verification').send(body)).status).toBe(200);
      }
      expect((await request(app).post('/api/auth/resend-verification').send(body)).status).toBe(429);
      expect((await request(app).post('/api/auth/forgot-password').send(body)).status).toBe(200);
    } finally {
      delete process.env.RATE_LIMIT_TEST;
    }
  });

  it('counts change-email per account, so naming an address never blocks anybody else', async () => {
    process.env.RATE_LIMIT_TEST = '1';
    try {
      const a = await makeUser('student', 'cap.a@alustudent.com');
      const b = await makeUser('student', 'cap.b@alustudent.com');
      const ask = (who, email) => request(app).post('/api/auth/change-email').set('Authorization', who.auth)
        .send({ email, current_password: 'password1234' });
      for (let i = 0; i < 5; i += 1) expect((await ask(a, `new${i}@alustudent.com`)).status).toBe(200);
      expect((await ask(a, 'new5@alustudent.com')).status).toBe(429);
      expect((await ask(b, 'new0@alustudent.com')).status).toBe(200);
      expect((await request(app).post('/api/auth/forgot-password').send({ email: 'new0@alustudent.com' })).status).toBe(200);
    } finally {
      delete process.env.RATE_LIMIT_TEST;
    }
  });

  it('stops sign-ups that name one address after five tries', async () => {
    process.env.RATE_LIMIT_TEST = '1';
    try {
      for (let i = 0; i < 5; i += 1) expect((await register({ email: 'many@alustudent.com' })).status).not.toBe(429);
      expect((await register({ email: 'many@alustudent.com' })).status).toBe(429);
    } finally {
      delete process.env.RATE_LIMIT_TEST;
    }
  });
});

describe('admin bookings window', () => {
  it('answers 400 for a day that matches the pattern but is not a date', async () => {
    const admin = await makeUser('admin');
    const res = await request(app).get('/api/admin/bookings?from=2026-13-45').set('Authorization', admin.auth);
    expect(res.status).toBe(400);
  });
});

describe('invitations stay safe when something fails', () => {
  const invite = (admin, email) => request(app).post('/api/admin/invites').set('Authorization', admin.auth).send({ email });
  const redeem = (invite_token) => request(app).post('/api/auth/redeem-invite')
    .send({ invite_token, name: 'Lawyer', password: 'a-long-password-1' });

  it('keeps the older invitation working when the new email cannot be sent', async () => {
    const admin = await makeUser('admin');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await invite(admin, 'lawyer@example.org')).status).toBe(201);
    const older = linkToken();
    const saved = process.env.SMTP_URL;
    process.env.SMTP_URL = 'smtp://127.0.0.1:1';
    try {
      expect((await invite(admin, 'lawyer@example.org')).status).toBe(502);
    } finally {
      if (saved === undefined) delete process.env.SMTP_URL; else process.env.SMTP_URL = saved;
    }
    expect((await redeem(older)).status).toBe(201);
  });

  it('does not use the invitation up when the account cannot be made', async () => {
    const admin = await makeUser('admin');
    expect((await invite(admin, 'lawyer@example.org')).status).toBe(201);
    const token = linkToken();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const hash = jest.spyOn(bcrypt, 'hash').mockRejectedValueOnce(new Error('boom'));
    expect((await redeem(token)).status).toBe(500);
    hash.mockRestore();
    expect((await redeem(token)).status).toBe(201);
  });
});

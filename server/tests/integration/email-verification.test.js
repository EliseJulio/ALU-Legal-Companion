// Email verification: a new account must prove it owns its email before it can sign in.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb } from '../helpers.js';

beforeEach(async () => {
  await resetDb();
});

const PASSWORD = 'student1234';
let emailSeq = 0;

// Registers a user and reads the verification link from the server log. The real token only
// exists inside the email, so this is how a test "opens the inbox". In dev mode the email is
// printed to the log, and here we capture that.
async function registerAndGrabToken() {
  const email = `reg.${Date.now()}.${++emailSeq}@alustudent.com`;
  const original = console.log;
  const logged = [];
  console.log = (...args) => logged.push(args.join(' '));
  let res;
  try {
    res = await request(app).post('/api/auth/register')
      .send({ name: 'A', email, password: PASSWORD, role: 'student' });
  } finally {
    console.log = original;
  }
  const match = logged.join('\n').match(/verify-email\?token=(\S+)/);
  if (!match) throw new Error('The dev mail mode printed no verification link');
  return { email, raw: decodeURIComponent(match[1]), res };
}

describe('registering', () => {
  test('creates an unverified account and does not sign the user in', async () => {
    const { email, res } = await registerAndGrabToken();
    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toMatchObject({ email });

    const [row] = await q('SELECT email_verified_at FROM users WHERE email = $1', [email]);
    expect(row.email_verified_at).toBeNull();

    const tokens = await q(
      'SELECT purpose FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = $1', [email]);
    expect(tokens).toEqual([{ purpose: 'verify_email' }]);
  });
});

describe('verifying an email', () => {
  test('a valid link verifies the account and signs the user in', async () => {
    const { email, raw } = await registerAndGrabToken();
    const res = await request(app).post('/api/auth/verify-email').send({ token: raw });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    const [row] = await q('SELECT email_verified_at FROM users WHERE email = $1', [email]);
    expect(row.email_verified_at).not.toBeNull();
  });

  test('the same link cannot be used twice', async () => {
    const { raw } = await registerAndGrabToken();
    await request(app).post('/api/auth/verify-email').send({ token: raw });
    const second = await request(app).post('/api/auth/verify-email').send({ token: raw });
    expect(second.status).toBe(400);
    expect(second.body.error).toMatch(/already been used/);
    expect(second.body.token).toBeUndefined();
  });

  test('an expired link says it has expired', async () => {
    const { raw } = await registerAndGrabToken();
    await q("UPDATE auth_tokens SET expires_at = now() - interval '1 hour'");
    const res = await request(app).post('/api/auth/verify-email').send({ token: raw });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/);
  });

  test('a link that does not exist is refused', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'not-a-real-token' });
    expect(res.status).toBe(400);
  });

  test('a missing token is a 400', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({});
    expect(res.status).toBe(400);
  });
});

describe('sending the link again', () => {
  test('gives the same answer whether or not the email has an account', async () => {
    // If the answers were different, anyone could use this to find out which emails are
    // registered.
    const real = await registerAndGrabToken();
    const a = await request(app).post('/api/auth/resend-verification').send({ email: real.email });
    const b = await request(app).post('/api/auth/resend-verification')
      .send({ email: `nobody.${Date.now()}@alustudent.com` });

    // Check the status itself too. Two identical 500 errors would also be "equal".
    expect(a.status).toBe(200);
    expect(a.status).toBe(b.status);
    expect(a.body).toEqual(b.body);
  });

  test('does not make a token for an email with no account', async () => {
    const ghost = `ghost.${Date.now()}@alustudent.com`;
    await request(app).post('/api/auth/resend-verification').send({ email: ghost });
    const rows = await q('SELECT 1 FROM auth_tokens');
    expect(rows).toHaveLength(0);
  });

  test('does not make a token for an account that is already verified', async () => {
    const { email } = await registerAndGrabToken();
    await q('UPDATE users SET email_verified_at = now()');
    await q('DELETE FROM auth_tokens');
    await request(app).post('/api/auth/resend-verification').send({ email });
    expect(await q('SELECT 1 FROM auth_tokens')).toHaveLength(0);
  });
});

describe('login needs a verified email', () => {
  test('an unverified user cannot sign in and is told why', async () => {
    const { email } = await registerAndGrabToken();
    const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });

    // 403 and not 401: the password was right, so this is not a wrong-login error.
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/verif/i);
    expect(res.body.error).toMatch(/link/i);
    expect(res.body.token).toBeUndefined();
  });

  test('a wrong password on an unverified account looks like any other wrong login', async () => {
    // The "not verified" message may only appear after the password is right. If it came
    // first, anyone could find out which emails have accounts without knowing a password.
    const { email } = await registerAndGrabToken();
    const wrongPassword = await request(app).post('/api/auth/login')
      .send({ email, password: 'not-the-password' });
    const noSuchUser = await request(app).post('/api/auth/login')
      .send({ email: `nobody.${Date.now()}@alustudent.com`, password: 'not-the-password' });

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual({ error: 'Incorrect email or password' });
    expect(wrongPassword.body).toEqual(noSuchUser.body);
  });

  test('after verifying, signing in works', async () => {
    const { email, raw } = await registerAndGrabToken();
    await request(app).post('/api/auth/verify-email').send({ token: raw });
    const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ email });
  });
});

describe('the whole flow', () => {
  test('register, blocked login, verify, sign in, reach a page that needs a login', async () => {
    const { email, raw, res: registered } = await registerAndGrabToken();
    expect(registered.status).toBe(201);

    const blocked = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(blocked.status).toBe(403);

    const verified = await request(app).post('/api/auth/verify-email').send({ token: raw });
    expect(verified.status).toBe(200);

    const signedIn = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(signedIn.status).toBe(200);

    // The token from login must really work on a protected route.
    const me = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${signedIn.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email, role: 'student' });
  });
});

describe('register tells the truth about delivery', () => {
  test('says the link is in the server log when no mail is set up', async () => {
    // tests/env.js sets SMTP_URL to empty, so this is dev mode and nothing is sent.
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'A', email: `honest.${Date.now()}@alustudent.com`, password: PASSWORD, role: 'student' });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/server log/i);
    // It must not send people to an inbox that will never get anything.
    expect(res.body.message).not.toMatch(/check your (inbox|email)/i);
  });

  test('says the email could not be sent when the mail server refuses it', async () => {
    const original = process.env.SMTP_URL;
    process.env.SMTP_URL = 'smtp://user:pass@127.0.0.1:1'; // nothing listens on port 1
    const originalError = console.error;
    console.error = () => {}; // the route logs the failure, hide it to keep the test output clean
    try {
      const email = `refused.${Date.now()}@alustudent.com`;
      const res = await request(app).post('/api/auth/register')
        .send({ name: 'A', email, password: PASSWORD, role: 'student' });

      // The account is still created. A 500 would wrongly say sign-up failed.
      expect(res.status).toBe(201);
      expect(await q('SELECT id FROM users WHERE email = $1', [email])).toHaveLength(1);
      expect(res.body.message).toMatch(/could not be sent/i);
      expect(res.body.message).toMatch(/sign-in page/i);
    } finally {
      console.error = originalError;
      if (original === undefined) delete process.env.SMTP_URL;
      else process.env.SMTP_URL = original;
    }
  });

  test('resend still gives the same answer when the mail server refuses', async () => {
    // Register may report a failed send, because it already shows the account exists.
    // Resend must not: a "could not send" would reveal that the email has an account.
    const { email } = await registerAndGrabToken();

    const original = process.env.SMTP_URL;
    process.env.SMTP_URL = 'smtp://user:pass@127.0.0.1:1';
    const originalError = console.error;
    console.error = () => {};
    try {
      const existing = await request(app).post('/api/auth/resend-verification').send({ email });
      const missing = await request(app).post('/api/auth/resend-verification')
        .send({ email: `nobody.${Date.now()}@alustudent.com` });

      expect(existing.status).toBe(missing.status);
      expect(JSON.stringify(existing.body)).toBe(JSON.stringify(missing.body));
    } finally {
      console.error = originalError;
      if (original === undefined) delete process.env.SMTP_URL;
      else process.env.SMTP_URL = original;
    }
  });
});

// Password reset. Without it, a person who forgot their password was locked out for good.
//
// Three rules matter most:
//   1. forgot-password gives the same answer whether or not the email has an account.
//   2. A successful reset also marks the email as verified, so the person is not then
//      blocked by the verification check.
//   3. Asking for a new reset link cancels the old one (but not a verification link).
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser } from '../helpers.js';

beforeEach(async () => {
  await resetDb();
});

const OLD_PASSWORD = 'password1234'; // the password makeUser gives every test user

let emailSeq = 0;
const nextEmail = (prefix) => `${prefix}.${Date.now()}.${++emailSeq}@alustudent.com`;

// The real token only exists inside the email. In dev mode the email is printed to the log,
// so this runs a request while capturing the log. That is how a test "opens the inbox".
async function capturingMail(run) {
  const original = console.log;
  const logged = [];
  console.log = (...args) => logged.push(args.join(' '));
  try {
    const res = await run();
    return { res, mail: logged.join('\n') };
  } finally {
    console.log = original;
  }
}

// Reads the token from a link with the given path. The path is checked so a reset link is not
// confused with a verification link printed in the same log.
function linkToken(mail, path) {
  const match = mail.match(new RegExp(`${path}\\?token=(\\S+)`));
  if (!match) throw new Error(`The dev mail mode printed no ${path} link`);
  return decodeURIComponent(match[1]);
}

// Asks for a reset link and returns the token from the email.
async function requestReset(email) {
  const { res, mail } = await capturingMail(() => request(app).post('/api/auth/forgot-password')
    .send({ email }));
  if (res.status !== 200) throw new Error(`forgot-password failed: ${res.status}`);
  return linkToken(mail, 'reset-password');
}

// A new account that has not verified its email yet.
async function registerUnverified() {
  const email = nextEmail('unverified');
  const { res } = await capturingMail(() => request(app).post('/api/auth/register')
    .send({ name: 'A', email, password: OLD_PASSWORD, role: 'student' }));
  if (res.status !== 201) throw new Error(`register failed: ${res.status}`);
  return email;
}

const resetWith = (token, password) =>
  request(app).post('/api/auth/reset-password').send({ token, password });

describe('asking for a reset link', () => {
  test('gives the same answer whether or not the email has an account', async () => {
    const { user } = await makeUser('student', nextEmail('real'));
    const a = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const b = await request(app).post('/api/auth/forgot-password')
      .send({ email: `nobody.${Date.now()}@alustudent.com` });
    // Check the status too. Two identical 500 errors would also be "equal".
    expect(a.status).toBe(200);
    expect(a.status).toBe(b.status);
    expect(a.body).toEqual(b.body);
  });

  test('makes no token for an email with no account', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: `ghost.${Date.now()}@alustudent.com` });
    expect(await q('SELECT 1 FROM auth_tokens')).toHaveLength(0);
  });

  test('gives the same answer when the mail server refuses', async () => {
    // A "could not send" answer would show that the email has an account.
    const { user } = await makeUser('student', nextEmail('refused'));
    const original = process.env.SMTP_URL;
    process.env.SMTP_URL = 'smtp://user:pass@127.0.0.1:1';
    const originalError = console.error;
    console.error = () => {};
    try {
      const existing = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
      const missing = await request(app).post('/api/auth/forgot-password')
        .send({ email: `nobody.${Date.now()}@alustudent.com` });
      expect(existing.status).toBe(200);
      expect(existing.body).toEqual(missing.body);
    } finally {
      console.error = originalError;
      if (original === undefined) delete process.env.SMTP_URL;
      else process.env.SMTP_URL = original;
    }
  });

  test('needs an email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

describe('using a reset link', () => {
  test('sets the new password and signs the user in', async () => {
    const { user } = await makeUser('student', nextEmail('reset'));
    const raw = await requestReset(user.email);
    const res = await resetWith(raw, 'brand-new-pass');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'brand-new-pass' });
    expect(login.status).toBe(200);
  });

  test('the old password stops working', async () => {
    const { user } = await makeUser('student', nextEmail('old'));
    await resetWith(await requestReset(user.email), 'brand-new-pass');
    const old = await request(app).post('/api/auth/login').send({ email: user.email, password: OLD_PASSWORD });
    expect(old.status).toBe(401);
  });

  test('the same link cannot be used twice', async () => {
    const { user } = await makeUser('student', nextEmail('twice'));
    const raw = await requestReset(user.email);
    await resetWith(raw, 'brand-new-pass');
    const second = await resetWith(raw, 'another-pass');
    expect(second.status).toBe(400);
    expect(second.body.error).toMatch(/already been used/);
  });

  test('asking for a new link cancels the previous one', async () => {
    // An old email could sit in a mailbox someone else reads later, so only the newest works.
    const { user } = await makeUser('student', nextEmail('newest'));
    const first = await requestReset(user.email);
    const second = await requestReset(user.email);
    expect((await resetWith(first, 'x-pass-1234')).status).toBe(400);
    expect((await resetWith(second, 'y-pass-1234')).status).toBe(200);
  });

  test('also verifies the email, so the person is not blocked by the verification check', async () => {
    // Opening the link proves they own the mailbox, which is what verification checks too.
    // Without this, an unverified person would reset their password and still not get in.
    const email = await registerUnverified();
    await resetWith(await requestReset(email), 'brand-new-pass');
    const [row] = await q('SELECT email_verified_at FROM users WHERE email = $1', [email]);
    expect(row.email_verified_at).not.toBeNull();
    const login = await request(app).post('/api/auth/login').send({ email, password: 'brand-new-pass' });
    expect(login.status).toBe(200);
  });

  test('a reset link does not work as a verification link', async () => {
    const { user } = await makeUser('student', nextEmail('cross'));
    const raw = await requestReset(user.email);
    const res = await request(app).post('/api/auth/verify-email').send({ token: raw });
    expect(res.status).toBe(400);
  });

  test('asking for a reset leaves a waiting verification link alone', async () => {
    // The two kinds of link are separate. Cancelling old reset links must not cancel this one.
    const email = await registerUnverified();
    await request(app).post('/api/auth/forgot-password').send({ email });

    const rows = await q(
      `SELECT t.purpose, t.used_at FROM auth_tokens t JOIN users u ON u.id = t.user_id
        WHERE u.email = $1`, [email]);
    const verify = rows.find((r) => r.purpose === 'verify_email');
    expect(verify).toBeTruthy();
    expect(verify.used_at).toBeNull();
  });

  test('refuses a short password, and keeps the link usable', async () => {
    const { user } = await makeUser('student', nextEmail('short'));
    const raw = await requestReset(user.email);
    const short = await resetWith(raw, 'short');
    expect(short.status).toBe(400);
    expect(short.body.error).toMatch(/8 characters/);
    // The link was not used up, so a good password still works.
    expect((await resetWith(raw, 'long-enough-password')).status).toBe(200);
  });

  test('refuses a password that is not text, and keeps the link usable', async () => {
    const { user } = await makeUser('student', nextEmail('nottext'));
    const raw = await requestReset(user.email);
    expect((await resetWith(raw, 12345678)).status).toBe(400);
    expect((await resetWith(raw, 'long-enough-password')).status).toBe(200);
  });

  test('refuses a missing token or password', async () => {
    expect((await request(app).post('/api/auth/reset-password').send({ password: 'long-enough-password' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'abc' })).status).toBe(400);
  });

  test('says an expired link has expired', async () => {
    const { user } = await makeUser('student', nextEmail('expired'));
    const raw = await requestReset(user.email);
    await q("UPDATE auth_tokens SET expires_at = now() - interval '1 hour'");
    const res = await resetWith(raw, 'long-enough-password');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/);
  });
});

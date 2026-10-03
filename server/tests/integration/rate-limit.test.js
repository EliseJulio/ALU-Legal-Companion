// Rate limits on the auth routes.
//
// The limits are off in tests by default. This file switches them on and switches them off
// again afterwards so other test files are not affected.
//
// Every request in this file comes from the same IP address, which is what a whole campus
// behind one network looks like to the server. So each test that wears down an IP limit
// does it in one test and the total stays under that limit. Account limits are kept apart
// by using a fresh email in each test.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser } from '../helpers.js';

let emailSeq = 0;
const freshEmail = (label) => `rl-${label}-${++emailSeq}@alustudent.com`;

beforeAll(() => {
  process.env.RATE_LIMIT_TEST = '1';
});

afterAll(() => {
  delete process.env.RATE_LIMIT_TEST;
});

beforeEach(async () => {
  await resetDb();
});

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('login: 10 failed attempts per email in 15 minutes', () => {
  test('11 wrong passwords for one account end in a 429', async () => {
    const email = freshEmail('brute');
    await makeUser('student', email);
    const statuses = [];
    let limitedBody = null;
    for (let i = 0; i < 11; i++) {
      const res = await login(email, 'wrong-password');
      statuses.push(res.status);
      if (res.status === 429 && !limitedBody) limitedBody = res.body;
    }
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(10);
    expect(limitedBody).toEqual({ error: 'Too many attempts. Please wait 15 minutes and try again.' });
  });

  test('11 "email not verified" answers never use up the budget', async () => {
    // A 403 only happens after the password was right so it is not password guessing.
    // Someone waiting for their verification email must not be locked out for refreshing.
    const email = freshEmail('unverified');
    const { user } = await makeUser('student', email);
    await q('UPDATE users SET email_verified_at = NULL WHERE id = $1', [user.id]);
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await login(email, 'password1234')).status);
    }
    expect(statuses.every((s) => s === 403)).toBe(true);
  });

  test('11 successful logins never use up the budget', async () => {
    const email = freshEmail('success');
    await makeUser('student', email);
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await login(email, 'password1234')).status);
    }
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  test('the limit is per account: another account is not affected', async () => {
    const drained = freshEmail('acct-a');
    const other = freshEmail('acct-b');
    let sawLimit = false;
    for (let i = 0; i < 11; i++) {
      if ((await login(drained, 'wrong-password')).status === 429) sawLimit = true;
    }
    expect(sawLimit).toBe(true);
    expect((await login(other, 'also-wrong')).status).toBe(401);
  });
});

describe('register has its own limit', () => {
  test('using up the login limit does not block registering', async () => {
    const drained = freshEmail('drain');
    let sawLimit = false;
    for (let i = 0; i < 11; i++) {
      if ((await login(drained, 'wrong-password')).status === 429) sawLimit = true;
    }
    expect(sawLimit).toBe(true);

    const res = await request(app).post('/api/auth/register').send({
      name: 'New Student', email: freshEmail('register'), password: 'password1234', role: 'student',
    });
    expect(res.status).toBe(201);
  });
});

describe('resend verification: 5 per email in 15 minutes', () => {
  test('the 6th request for one email gets a 429', async () => {
    const email = freshEmail('resend');
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await request(app).post('/api/auth/resend-verification').send({ email })).status);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });

  test('the limit is the same whether or not the email has an account', async () => {
    // The count is based on what was typed, so a 429 does not show which emails exist.
    const { user } = await makeUser('student', freshEmail('real'));
    await q('UPDATE users SET email_verified_at = NULL WHERE id = $1', [user.id]);
    const real = [];
    const ghost = [];
    const ghostEmail = freshEmail('ghost');
    for (let i = 0; i < 6; i++) {
      real.push((await request(app).post('/api/auth/resend-verification').send({ email: user.email })).status);
      ghost.push((await request(app).post('/api/auth/resend-verification').send({ email: ghostEmail })).status);
    }
    expect(real).toEqual(ghost);
  });

  test('a different email still works after one is limited', async () => {
    const limited = freshEmail('limited');
    for (let i = 0; i < 6; i++) {
      await request(app).post('/api/auth/resend-verification').send({ email: limited });
    }
    const res = await request(app).post('/api/auth/resend-verification').send({ email: freshEmail('other') });
    expect(res.status).toBe(200);
  });
});

describe('forgot password: 5 per email in 15 minutes', () => {
  test('the 6th request for one email gets a 429, whether or not the email has an account', async () => {
    const email = freshEmail('forgot');
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await request(app).post('/api/auth/forgot-password').send({ email })).status);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });
});

describe('questions: lookups and submissions', () => {
  test('the 101st guess at an anonymous token gets a 429', async () => {
    const statuses = [];
    for (let i = 0; i < 101; i++) {
      statuses.push((await request(app).get('/api/questions/anon/FAKE-TOKN-0000')).status);
    }
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s === 404).length).toBeLessThanOrEqual(100);
  });

  test('the 31st anonymous submission in an hour gets a 429', async () => {
    const statuses = [];
    let limitedBody = null;
    for (let i = 0; i < 31; i++) {
      const res = await request(app).post('/api/questions').send({ text: `Rate limit test question ${i}` });
      statuses.push(res.status);
      if (res.status === 429 && !limitedBody) limitedBody = res.body;
    }
    expect(statuses).toContain(429);
    expect(limitedBody).toEqual({ error: 'Too many submissions. Please wait a while and try again.' });
  });
});

describe('verify-email: 100 per IP in 15 minutes', () => {
  test('the 101st request gets a 429', async () => {
    const statuses = [];
    for (let i = 0; i < 101; i++) {
      statuses.push((await request(app).post('/api/auth/verify-email').send({ token: 'not-a-real-token' })).status);
    }
    expect(statuses.slice(0, 100).every((s) => s === 400)).toBe(true);
    expect(statuses[100]).toBe(429);
  });
});

import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser } from '../helpers.js';

let admin;
let student;
let mails;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
  student = await makeUser('student');
  mails = [];
  jest.spyOn(console, 'log').mockImplementation((text) => { mails.push(String(text)); });
});
afterEach(() => { jest.restoreAllMocks(); });

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const invite = (body) => as(admin, 'post', '/api/admin/invites').send(body);
const redeem = (body) => request(app).post('/api/auth/redeem-invite').send(body);
const tokenFromLastMail = () => {
  const match = /[?&]token=([^\s&]+)/.exec(mails[mails.length - 1] || '');
  return match ? decodeURIComponent(match[1]) : null;
};
const PERSON = { name: 'Test Lawyer', password: 'a-long-test-password' };

describe('POST /api/admin/invites', () => {
  it('emails the invitation and never returns the token to the admin', async () => {
    const res = await invite({ email: 'new.lawyer@example.org' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'new.lawyer@example.org' });
    expect(res.body.message).toMatch(/printed in the server log/);
    expect(JSON.stringify(res.body)).not.toContain(tokenFromLastMail());
    expect(mails[0]).toContain('To:      new.lawyer@example.org');
    expect(mails[0]).toMatch(/\/redeem-invite\?token=/);
  });

  it('writes the email in lower case and trims it', async () => {
    const res = await invite({ email: '  New.Lawyer@Example.org ' });
    expect(res.body.email).toBe('new.lawyer@example.org');
  });

  it('expires in seven days unless the admin says otherwise', async () => {
    const res = await invite({ email: 'a@example.org' });
    const days = (new Date(res.body.expires_at) - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    const short = await invite({ email: 'b@example.org', expires_days: 1 });
    expect((new Date(short.body.expires_at) - Date.now()) / 86400000).toBeLessThan(1.1);
  });

  it('keeps only the hash of the token', async () => {
    await invite({ email: 'a@example.org' });
    const token = tokenFromLastMail();
    const [row] = await q('SELECT token_hash FROM invite_tokens');
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_hash).not.toContain(token);
  });

  it.each([
    ['no email', {}, /email is required/],
    ['an email that is not an email', { email: 'not-an-email' }, /not a valid email/],
    ['an email with a space', { email: 'a b@example.org' }, /not a valid email/],
    ['zero days', { email: 'a@example.org', expires_days: 0 }, /expires_days/],
    ['too many days', { email: 'a@example.org', expires_days: 31 }, /expires_days/],
    ['days that are not whole', { email: 'a@example.org', expires_days: 1.5 }, /expires_days/],
    ['days in words', { email: 'a@example.org', expires_days: 'seven' }, /expires_days/],
  ])('refuses %s', async (_label, body, message) => {
    const res = await invite(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(mails).toHaveLength(0);
  });

  it('refuses an address that already has an account', async () => {
    const res = await invite({ email: student.user.email });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/);
  });

  it('cancels the older invitation for the same address', async () => {
    await invite({ email: 'a@example.org' });
    const older = tokenFromLastMail();
    await invite({ email: 'a@example.org' });
    const newer = tokenFromLastMail();
    const oldTry = await redeem({ invite_token: older, ...PERSON });
    expect(oldTry.status).toBe(400);
    expect(oldTry.body.error).toMatch(/already been used or replaced/);
    expect((await redeem({ invite_token: newer, ...PERSON })).status).toBe(201);
  });

  it('throws the invitation away and says so when the email cannot be sent', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.SMTP_URL = 'smtp://127.0.0.1:1';
    try {
      const res = await invite({ email: 'a@example.org' });
      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/could not be sent/);
      const [{ n }] = await q('SELECT count(*)::int AS n FROM invite_tokens');
      expect(n).toBe(0);
      expect(errors).toHaveBeenCalled();
    } finally {
      process.env.SMTP_URL = '';
    }
  });
});

describe('GET /api/admin/invites', () => {
  it('lists the invitations with their state and never the token', async () => {
    await invite({ email: 'pending@example.org' });
    await invite({ email: 'expired@example.org' });
    await q("UPDATE invite_tokens SET expires_at = now() - interval '1 day' WHERE email = 'expired@example.org'");
    await invite({ email: 'used@example.org' });
    await redeem({ invite_token: tokenFromLastMail(), ...PERSON });

    const res = await as(admin, 'get', '/api/admin/invites');
    expect(res.status).toBe(200);
    const byEmail = Object.fromEntries(res.body.map((i) => [i.email, i.status]));
    expect(byEmail).toEqual({ 'pending@example.org': 'pending', 'expired@example.org': 'expired', 'used@example.org': 'used' });
    expect(res.body[0].invited_by).toBe('Test admin');
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
  });
});

describe('POST /api/auth/redeem-invite', () => {
  it('makes a legal expert whose address counts as verified and signs them in', async () => {
    await invite({ email: 'new.lawyer@example.org' });
    const res = await redeem({ invite_token: tokenFromLastMail(), ...PERSON });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Test Lawyer', email: 'new.lawyer@example.org', role: 'legal_expert' });

    const [row] = await q("SELECT email_verified_at, role FROM users WHERE email = 'new.lawyer@example.org'");
    expect(row.email_verified_at).not.toBeNull();
    expect((await request(app).get('/api/questions/open').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200);
  });

  it('lets the new expert sign in with the password they chose', async () => {
    await invite({ email: 'new.lawyer@example.org' });
    await redeem({ invite_token: tokenFromLastMail(), ...PERSON });
    const res = await request(app).post('/api/auth/login').send({ email: 'new.lawyer@example.org', password: PERSON.password });
    expect(res.status).toBe(200);
  });

  it('works only once', async () => {
    await invite({ email: 'new.lawyer@example.org' });
    const token = tokenFromLastMail();
    await redeem({ invite_token: token, ...PERSON });
    const again = await redeem({ invite_token: token, ...PERSON });
    expect(again.status).toBe(400);
    expect(again.body.error).toMatch(/already been used/);
  });

  it('lets only one of two simultaneous uses through', async () => {
    await invite({ email: 'new.lawyer@example.org' });
    const token = tokenFromLastMail();
    const results = await Promise.all([
      redeem({ invite_token: token, ...PERSON }),
      redeem({ invite_token: token, name: 'Other Person', password: 'another-long-password' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    const [{ n }] = await q("SELECT count(*)::int AS n FROM users WHERE email = 'new.lawyer@example.org'");
    expect(n).toBe(1);
  });

  it('says an invitation expired', async () => {
    await invite({ email: 'new.lawyer@example.org' });
    await q("UPDATE invite_tokens SET expires_at = now() - interval '1 minute'");
    const res = await redeem({ invite_token: tokenFromLastMail(), ...PERSON });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/);
  });

  it('refuses a made-up invitation', async () => {
    const res = await redeem({ invite_token: 'made-up', ...PERSON });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not valid/);
  });

  it('keeps the invitation alive when the name or password is refused', async () => {
    await invite({ email: 'new.lawyer@example.org' });
    const token = tokenFromLastMail();
    expect((await redeem({ invite_token: token, name: 'Test Lawyer', password: 'short' })).status).toBe(400);
    expect((await redeem({ invite_token: token, name: 'x'.repeat(101), password: PERSON.password })).status).toBe(400);
    expect((await redeem({ invite_token: token, name: '   ', password: PERSON.password })).status).toBe(400);
    expect((await redeem({ invite_token: token, name: 'Test Lawyer', password: 12345678 })).status).toBe(400);
    expect((await redeem({ invite_token: token, ...PERSON })).status).toBe(201);
  });

  it('refuses a request with a missing field', async () => {
    expect((await redeem({ name: 'x', password: 'a-long-test-password' })).status).toBe(400);
    expect((await redeem({ invite_token: 'x', password: 'a-long-test-password' })).status).toBe(400);
    expect((await redeem({ invite_token: 'x', name: 'x' })).status).toBe(400);
  });

  it('gives the invitation back when somebody made an account with that address in the meantime', async () => {
    await invite({ email: 'new.lawyer@example.org' });
    const token = tokenFromLastMail();
    await makeUser('staff', 'new.lawyer@example.org');
    const res = await redeem({ invite_token: token, ...PERSON });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/);
    const [row] = await q('SELECT used_at FROM invite_tokens');
    expect(row.used_at).toBeNull();
  });

  it('is the only way to get the legal expert role', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Sneaky', email: 'sneaky@alustudent.com', password: 'a-long-test-password', role: 'legal_expert',
    });
    expect(res.status).toBe(400);
    expect((await as(admin, 'put', `/api/admin/users/${student.user.id}/role`).send({ role: 'legal_expert' })).status).toBe(400);
  });
});

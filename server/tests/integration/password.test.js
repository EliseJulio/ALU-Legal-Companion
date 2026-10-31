import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { issueToken } from '../../src/services/authTokens.js';
import { resetDb, makeUser } from '../helpers.js';

const OLD_PASSWORD = 'password1234'; // the one makeUser gives every account
const NEW_PASSWORD = 'a-brand-new-password-2';

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

const forgot = (email) => request(app).post('/api/auth/forgot-password').send({ email });
const reset = (token, password) => request(app).post('/api/auth/reset-password').send({ token, password });
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
const me = (auth) => request(app).get('/api/auth/me').set('Authorization', auth);

describe('POST /api/auth/forgot-password', () => {
  it('gives the same answer for every address', async () => {
    await makeUser('student', 'real@alustudent.com');
    const known = await forgot('real@alustudent.com');
    const unknown = await forgot('nobody@alustudent.com');
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
  });

  it('sends a reset link only to an account that exists', async () => {
    await makeUser('student', 'real@alustudent.com');
    await forgot('nobody@alustudent.com');
    expect(mails).toHaveLength(0);
    await forgot('real@alustudent.com');
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatch(/\/reset-password\?token=/);
    expect(mails[0]).toContain('To:      real@alustudent.com');
  });

  it('sends nothing to a switched-off account and gives the same answer', async () => {
    const { user } = await makeUser('student', 'off@alustudent.com');
    await q('UPDATE users SET deactivated_at = now() WHERE id = $1', [user.id]);
    const res = await forgot('off@alustudent.com');
    const unknown = await forgot('nobody@alustudent.com');
    expect(mails).toHaveLength(0);
    expect(res.body).toEqual(unknown.body);
  });

  it('cancels the older link when a new one is asked for', async () => {
    await makeUser('student', 'real@alustudent.com');
    await forgot('real@alustudent.com');
    const older = tokenFromLastMail();
    await forgot('real@alustudent.com');
    const newer = tokenFromLastMail();

    const oldTry = await reset(older, NEW_PASSWORD);
    expect(oldTry.status).toBe(400);
    expect(oldTry.body.error).toMatch(/already been used/i);
    expect((await reset(newer, NEW_PASSWORD)).status).toBe(200);
  });

  it('leaves a pending verification link alone', async () => {
    const { user } = await makeUser('student', 'real@alustudent.com');
    const verifyToken = await issueToken(user.id, 'verify_email');
    await forgot('real@alustudent.com');
    const [row] = await q("SELECT used_at FROM auth_tokens WHERE purpose = 'verify_email'");
    expect(row.used_at).toBeNull();
    expect(verifyToken).toBeTruthy();
  });

  it('refuses a request with no email', async () => {
    expect((await request(app).post('/api/auth/forgot-password').send({})).status).toBe(400);
  });
});

describe('POST /api/auth/reset-password', () => {
  const askForLink = async (email = 'real@alustudent.com') => {
    await forgot(email);
    return tokenFromLastMail();
  };

  it('sets the new password, signs the person in and drops the old password', async () => {
    const { user, auth } = await makeUser('student', 'real@alustudent.com');
    const link = await askForLink();
    const res = await reset(link, NEW_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect((await me(`Bearer ${res.body.token}`)).status).toBe(200);

    expect((await login('real@alustudent.com', NEW_PASSWORD)).status).toBe(200);
    expect((await login('real@alustudent.com', OLD_PASSWORD)).status).toBe(401);
    expect(auth).toBeTruthy();
  });

  it('ends every session that was open before the reset', async () => {
    const { auth } = await makeUser('student', 'real@alustudent.com');
    const link = await askForLink();
    expect((await me(auth)).status).toBe(200);
    await reset(link, NEW_PASSWORD);
    expect((await me(auth)).status).toBe(401);
  });

  it('counts the address as verified because the link proves the mailbox', async () => {
    const { user } = await makeUser('student', 'real@alustudent.com');
    await q('UPDATE users SET email_verified_at = NULL WHERE id = $1', [user.id]);
    const link = await askForLink();
    expect((await login('real@alustudent.com', OLD_PASSWORD)).status).toBe(403);
    await reset(link, NEW_PASSWORD);
    expect((await login('real@alustudent.com', NEW_PASSWORD)).status).toBe(200);
  });

  it('works only once', async () => {
    await makeUser('student', 'real@alustudent.com');
    const link = await askForLink();
    await reset(link, NEW_PASSWORD);
    const again = await reset(link, 'another-new-password-3');
    expect(again.status).toBe(400);
    expect(again.body.error).toMatch(/already been used/i);
  });

  it('says a link expired', async () => {
    await makeUser('student', 'real@alustudent.com');
    const link = await askForLink();
    await q("UPDATE auth_tokens SET expires_at = now() - interval '1 minute'");
    const res = await reset(link, NEW_PASSWORD);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('refuses a made-up link', async () => {
    const res = await reset('made-up', NEW_PASSWORD);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not valid/i);
  });

  it('does not accept a verification link as a reset link', async () => {
    const { user } = await makeUser('student', 'real@alustudent.com');
    const verifyToken = await issueToken(user.id, 'verify_email');
    expect((await reset(verifyToken, NEW_PASSWORD)).status).toBe(400);
  });

  it('keeps the link alive when the new password is too short', async () => {
    await makeUser('student', 'real@alustudent.com');
    const link = await askForLink();
    const short = await reset(link, 'short');
    expect(short.status).toBe(400);
    expect(short.body.error).toMatch(/at least 8/i);
    expect((await reset(link, NEW_PASSWORD)).status).toBe(200);
  });

  it('refuses a password that is not text and keeps the link alive', async () => {
    await makeUser('student', 'real@alustudent.com');
    const link = await askForLink();
    expect((await reset(link, 12345678)).status).toBe(400);
    expect((await reset(link, NEW_PASSWORD)).status).toBe(200);
  });

  it('refuses a request with a missing field', async () => {
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'x' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ password: NEW_PASSWORD })).status).toBe(400);
  });

  it('does not reset an account that was switched off after the link was sent', async () => {
    const { user } = await makeUser('student', 'real@alustudent.com');
    const link = await askForLink();
    await q('UPDATE users SET deactivated_at = now() WHERE id = $1', [user.id]);
    const res = await reset(link, NEW_PASSWORD);
    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
    await q('UPDATE users SET deactivated_at = NULL WHERE id = $1', [user.id]);
    expect((await login('real@alustudent.com', OLD_PASSWORD)).status).toBe(200);
  });
});

describe('POST /api/auth/change-password', () => {
  const change = (auth, body) => request(app).post('/api/auth/change-password').set('Authorization', auth).send(body);

  it('needs a login', async () => {
    const res = await request(app).post('/api/auth/change-password').send({ current_password: OLD_PASSWORD, new_password: NEW_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('changes the password and keeps the caller signed in with a new token', async () => {
    const { auth } = await makeUser('student', 'real@alustudent.com');
    const res = await change(auth, { current_password: OLD_PASSWORD, new_password: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect((await me(`Bearer ${res.body.token}`)).status).toBe(200);
    expect((await login('real@alustudent.com', NEW_PASSWORD)).status).toBe(200);
    expect((await login('real@alustudent.com', OLD_PASSWORD)).status).toBe(401);
  });

  it('ends the other sessions', async () => {
    const { auth } = await makeUser('student', 'real@alustudent.com');
    const other = `Bearer ${(await login('real@alustudent.com', OLD_PASSWORD)).body.token}`;
    await change(auth, { current_password: OLD_PASSWORD, new_password: NEW_PASSWORD });
    expect((await me(auth)).status).toBe(401);
    expect((await me(other)).status).toBe(401);
  });

  it('refuses a wrong current password and changes nothing', async () => {
    const { auth } = await makeUser('student', 'real@alustudent.com');
    const res = await change(auth, { current_password: 'not-the-password', new_password: NEW_PASSWORD });
    // 400 and not 401. A 401 would sign the person out of the website.
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not correct/i);
    expect((await login('real@alustudent.com', OLD_PASSWORD)).status).toBe(200);
  });

  it('tells about the length rule before it checks the current password', async () => {
    const { auth } = await makeUser('student', 'real@alustudent.com');
    const res = await change(auth, { current_password: 'not-the-password', new_password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 8/i);
  });

  it('can only change the password of the account that is signed in', async () => {
    const { auth } = await makeUser('student', 'mine@alustudent.com');
    await makeUser('student', 'theirs@alustudent.com');
    const [theirs] = await q("SELECT id FROM users WHERE email = 'theirs@alustudent.com'");
    await change(auth, { current_password: OLD_PASSWORD, new_password: NEW_PASSWORD, id: theirs.id, email: 'theirs@alustudent.com' });
    expect((await login('theirs@alustudent.com', OLD_PASSWORD)).status).toBe(200);
    expect((await login('mine@alustudent.com', NEW_PASSWORD)).status).toBe(200);
  });
});

describe('PUT /api/auth/me', () => {
  const rename = (auth, body) => request(app).put('/api/auth/me').set('Authorization', auth).send(body);

  it('needs a login', async () => {
    expect((await request(app).put('/api/auth/me').send({ name: 'New Name' })).status).toBe(401);
  });

  it('renames the account and returns a token that carries the new name', async () => {
    const { auth, user } = await makeUser('student', 'real@alustudent.com');
    const res = await rename(auth, { name: '  New Name  ' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
    expect(jwt.decode(res.body.token).name).toBe('New Name');
    const [row] = await q('SELECT name FROM users WHERE id = $1', [user.id]);
    expect(row.name).toBe('New Name');
  });

  it('reads the name and nothing else', async () => {
    const { auth, user } = await makeUser('student', 'real@alustudent.com');
    await rename(auth, { name: 'New Name', role: 'admin', email: 'other@alustudent.com', session_version: 99 });
    const [row] = await q('SELECT role, email, session_version FROM users WHERE id = $1', [user.id]);
    expect(row).toEqual({ role: 'student', email: 'real@alustudent.com', session_version: 0 });
  });

  it('refuses an empty name, a name that is not text and a very long name', async () => {
    const { auth } = await makeUser('student', 'real@alustudent.com');
    expect((await rename(auth, { name: '   ' })).status).toBe(400);
    expect((await rename(auth, { name: 42 })).status).toBe(400);
    expect((await rename(auth, {})).status).toBe(400);
    expect((await rename(auth, { name: 'x'.repeat(101) })).status).toBe(400);
    expect((await rename(auth, { name: 'x'.repeat(100) })).status).toBe(200);
  });
});

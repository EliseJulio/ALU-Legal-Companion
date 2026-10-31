// Changing the email address of an account.
//
// The rules that matter: the account keeps its old address until the link sent to the new one is
// used, so a typo cannot lock anyone out. The password is needed to start. The answer never shows
// which addresses already have an account. And using the link ends every older session.
import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { issueToken } from '../../src/services/authTokens.js';
import { resetDb, makeUser } from '../helpers.js';

const PASSWORD = 'password1234'; // what makeUser gives every test account
const NEW = 'new.student@alustudent.com';

// The server prints each email in dev mode. This collects them so a test can read the link.
let mails;
beforeEach(async () => {
  await resetDb();
  mails = [];
  jest.spyOn(console, 'log').mockImplementation((...args) => { mails.push(args.join(' ')); });
});
afterEach(() => { jest.restoreAllMocks(); });

const mailsTo = (address) => mails.filter((m) => m.includes(address));
const tokenIn = (mail) => {
  const match = /[?&]token=([^\s&"]+)/.exec(mail || '');
  return match ? decodeURIComponent(match[1]) : null;
};
const ask = (user, body) => request(app).post('/api/auth/change-email').set('Authorization', user.auth).send(body);
const confirm = (token) => request(app).post('/api/auth/confirm-email-change').send({ token });
const me = (auth) => request(app).get('/api/auth/me').set('Authorization', auth);
const login = (email, password = PASSWORD) => request(app).post('/api/auth/login').send({ email, password });
const row = async (id) => (await q('SELECT email, pending_email, email_verified_at FROM users WHERE id = $1', [id]))[0];

describe('asking to change the address', () => {
  it('needs a login', async () => {
    const res = await request(app).post('/api/auth/change-email').send({ email: NEW, current_password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('refuses something that is not an address', async () => {
    const student = await makeUser('student');
    for (const email of ['', 'not an address', 'two@@alustudent.com', undefined]) {
      const res = await ask(student, { email, current_password: PASSWORD });
      expect([email, res.status]).toEqual([email, 400]);
    }
    expect((await row(student.user.id)).pending_email).toBeNull();
  });

  it('refuses a wrong password with 400 and stores nothing', async () => {
    const student = await makeUser('student');
    const res = await ask(student, { email: NEW, current_password: 'wrong-password-1' });
    expect(res.status).toBe(400);
    expect((await row(student.user.id)).pending_email).toBeNull();
    expect(mailsTo(NEW)).toHaveLength(0);
  });

  it('refuses a request with no password at all', async () => {
    const student = await makeUser('student');
    const res = await ask(student, { email: NEW });
    expect(res.status).toBe(400);
    expect((await row(student.user.id)).pending_email).toBeNull();
  });

  it('refuses the address the account already has', async () => {
    const student = await makeUser('student');
    const res = await ask(student, { email: ` ${student.user.email.toUpperCase()} `, current_password: PASSWORD });
    expect(res.status).toBe(400);
  });

  it('holds students and staff to the ALU domains but lets a legal expert use any address', async () => {
    const student = await makeUser('student');
    const staff = await makeUser('staff');
    const expert = await makeUser('legal_expert');

    expect((await ask(student, { email: 'someone@gmail.com', current_password: PASSWORD })).status).toBe(400);
    expect((await ask(staff, { email: 'someone@gmail.com', current_password: PASSWORD })).status).toBe(400);
    expect((await ask(student, { email: 'other@alueducation.com', current_password: PASSWORD })).status).toBe(200);

    expect((await ask(expert, { email: 'real.lawyer@gmail.com', current_password: PASSWORD })).status).toBe(200);
    expect((await row(expert.user.id)).pending_email).toBe('real.lawyer@gmail.com');
  });

  it('keeps the old address, stores the new one as pending and sends the link to the new address only', async () => {
    const student = await makeUser('student');
    const oldAddress = student.user.email;
    const res = await ask(student, { email: NEW, current_password: PASSWORD });
    expect(res.status).toBe(200);

    const after = await row(student.user.id);
    expect(after.email).toBe(oldAddress); // nothing has changed yet
    expect(after.pending_email).toBe(NEW);

    const withLink = mails.filter((m) => tokenIn(m));
    expect(withLink).toHaveLength(1);
    expect(withLink[0]).toContain(NEW);
    expect(withLink[0]).toMatch(/confirm-email-change\?token=/);

    // The old address is warned. Its message holds no link and does not spell out the new address.
    const toOld = mailsTo(oldAddress).filter((m) => !tokenIn(m));
    expect(toOld).toHaveLength(1);
    expect(toOld[0]).not.toContain(NEW);
  });

  it('still lets the person sign in with the old address while the change waits', async () => {
    const student = await makeUser('student');
    await ask(student, { email: NEW, current_password: PASSWORD });
    expect((await login(student.user.email)).status).toBe(200);
    expect((await login(NEW)).status).toBe(401);
  });

  it('writes the new address in lower case without spaces', async () => {
    const student = await makeUser('student');
    await ask(student, { email: '  New.Student@AluStudent.com ', current_password: PASSWORD });
    expect((await row(student.user.id)).pending_email).toBe(NEW);
  });

  it('gives the same answer for an address that already has an account, and stores and sends nothing', async () => {
    const student = await makeUser('student');
    const other = await makeUser('student', 'other@alustudent.com');

    const taken = await ask(student, { email: other.user.email, current_password: PASSWORD });
    expect(taken.status).toBe(200);
    expect((await row(student.user.id)).pending_email).toBeNull();
    expect(mails.filter((m) => tokenIn(m))).toHaveLength(0);

    const free = await ask(student, { email: NEW, current_password: PASSWORD });
    // Nobody can tell from the answer which of the two addresses has an account.
    expect(free.status).toBe(taken.status);
    expect(free.body).toEqual(taken.body);
  });

  it('shows the waiting address on the account and nothing before a change is asked for', async () => {
    const student = await makeUser('student');
    const oldAddress = student.user.email;
    expect((await me(student.auth)).body.pending_email).toBeNull();
    await ask(student, { email: NEW, current_password: PASSWORD });
    const after = (await me(student.auth)).body;
    expect(after.pending_email).toBe(NEW);
    expect(after.email).toBe(oldAddress);
  });
});

describe('using the link', () => {
  const start = async (user, email = NEW) => {
    await ask(user, { email, current_password: PASSWORD });
    return tokenIn(mails.filter((m) => m.includes(email)).find((m) => tokenIn(m)));
  };

  it('switches the address, counts it as verified, clears the waiting one and signs the person in again', async () => {
    const student = await makeUser('student');
    const oldAddress = student.user.email;
    await q('UPDATE users SET email_verified_at = NULL WHERE id = $1', [student.user.id]);
    const token = await start(student);

    const res = await confirm(token);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(NEW);

    const after = await row(student.user.id);
    expect(after.email).toBe(NEW);
    expect(after.pending_email).toBeNull();
    expect(after.email_verified_at).not.toBeNull(); // opening the link proved the mailbox

    expect((await me(`Bearer ${res.body.token}`)).body.email).toBe(NEW);
    expect((await login(NEW)).status).toBe(200);
    expect((await login(oldAddress)).status).toBe(401);
  });

  it('ends every older session', async () => {
    const student = await makeUser('student');
    const token = await start(student);
    expect((await me(student.auth)).status).toBe(200);
    await confirm(token);
    expect((await me(student.auth)).status).toBe(401);
  });

  it('works from a browser where nobody is signed in', async () => {
    const student = await makeUser('student');
    const token = await start(student);
    const res = await request(app).post('/api/auth/confirm-email-change').send({ token });
    expect(res.status).toBe(200);
  });

  it('tells the old address that the account moved, with no link in it', async () => {
    const student = await makeUser('student');
    const oldAddress = student.user.email;
    const token = await start(student);
    mails.length = 0;
    await confirm(token);
    const toOld = mailsTo(oldAddress);
    expect(toOld).toHaveLength(1);
    expect(tokenIn(toOld[0])).toBeNull();
  });

  it('works once', async () => {
    const student = await makeUser('student');
    const token = await start(student);
    expect((await confirm(token)).status).toBe(200);
    expect((await confirm(token)).status).toBe(400);
  });

  it('refuses a link that has expired', async () => {
    const student = await makeUser('student');
    const oldAddress = student.user.email;
    const token = await start(student);
    await q(`UPDATE auth_tokens SET expires_at = now() - interval '1 hour' WHERE purpose = 'change_email'`);
    expect((await confirm(token)).status).toBe(400);
    expect((await row(student.user.id)).email).toBe(oldAddress);
  });

  it('refuses a link made for something else, such as verifying an address', async () => {
    const student = await makeUser('student');
    const oldAddress = student.user.email;
    await ask(student, { email: NEW, current_password: PASSWORD });
    const wrong = await issueToken(student.user.id, 'verify_email');
    expect((await confirm(wrong)).status).toBe(400);
    expect((await row(student.user.id)).email).toBe(oldAddress);
  });

  it('refuses a made-up link and a missing one', async () => {
    expect((await confirm('not-a-real-token')).status).toBe(400);
    expect((await request(app).post('/api/auth/confirm-email-change').send({})).status).toBe(400);
  });

  it('cancels the first link when a second change is asked for, so only the newest works', async () => {
    const student = await makeUser('student');
    const first = await start(student, NEW);
    const second = await start(student, 'second.try@alustudent.com');

    expect((await confirm(first)).status).toBe(400);
    expect((await confirm(second)).status).toBe(200);
    expect((await row(student.user.id)).email).toBe('second.try@alustudent.com');
  });

  it('refuses the switch when someone took that address in the meantime', async () => {
    const student = await makeUser('student');
    const oldAddress = student.user.email;
    const token = await start(student);
    await q(
      `INSERT INTO users (name, email, password_hash, role, email_verified_at) VALUES ('Other', $1, 'x', 'student', now())`,
      [NEW],
    );
    const res = await confirm(token);
    expect(res.status).toBe(400);
    expect((await row(student.user.id)).email).toBe(oldAddress);
  });

  it('does nothing for an account that has been switched off', async () => {
    const student = await makeUser('student');
    const oldAddress = student.user.email;
    const token = await start(student);
    await q('UPDATE users SET deactivated_at = now() WHERE id = $1', [student.user.id]);
    expect((await confirm(token)).status).toBe(400);
    expect((await row(student.user.id)).email).toBe(oldAddress);
  });
});

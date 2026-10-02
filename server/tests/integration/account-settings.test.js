// The account a person manages themselves: their name, email and password.
//
// Changing the email and the password are security events, so the tests focus on that:
//   - The email is the reset channel. Whoever controls it can take the account with
//     forgot-password. So a change needs the current password, and must be confirmed from the
//     NEW address before it takes effect.
//   - Changing the password is what someone does when they think they are compromised, so it
//     ends every other session and keeps the one that asked.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser } from '../helpers.js';
import { issueToken } from '../../src/services/authTokens.js';

let student;
let expert;
let other;

beforeEach(async () => {
  await resetDb();
  student = await makeUser('student', 'student.acct@alustudent.com');
  expert = await makeUser('legal_expert', 'expert.acct@example.org');
  other = await makeUser('student', 'other.acct@alustudent.com');
});

const PASSWORD = 'password1234'; // the password makeUser gives every test user

const changeEmail = (who, email, password = PASSWORD) => request(app)
  .post('/api/auth/change-email').set('Authorization', who.auth).send({ email, password });

// Starts an email change without the email step: it sets the pending address and makes a
// token directly, so the test holds the real token the email would have carried.
async function startChange(userId, email) {
  await q('UPDATE users SET pending_email = $1 WHERE id = $2', [email, userId]);
  return issueToken(userId, 'change_email', 24);
}

describe('GET /api/auth/me', () => {
  test('answers with the current data, not what the token says', async () => {
    await q('UPDATE users SET name = $1 WHERE id = $2', ['Renamed Later', student.user.id]);
    const res = await request(app).get('/api/auth/me').set('Authorization', student.auth);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Later');
  });

  test('reports if the email is confirmed and when the account was made', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', student.auth);
    expect(res.body.email_verified_at).not.toBeNull();
    expect(res.body).toHaveProperty('created_at');
    expect(res.body).toHaveProperty('role', 'student');
  });

  test('reports an email change that is waiting to be confirmed', async () => {
    await changeEmail(student, 'pending.shown@alustudent.com');
    const res = await request(app).get('/api/auth/me').set('Authorization', student.auth);
    expect(res.body.pending_email).toBe('pending.shown@alustudent.com');
  });

  test('reports null, not a missing field, when nothing is waiting', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', student.auth);
    expect(res.body).toHaveProperty('pending_email', null);
  });

  test('never returns the password hash or the session counter', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', student.auth);
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body).not.toHaveProperty('session_version');
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/); // the start of a bcrypt hash
  });
});

describe('PUT /api/auth/me: changing your name', () => {
  test('renames the account and returns a token with the new name', async () => {
    const res = await request(app).put('/api/auth/me')
      .set('Authorization', student.auth).send({ name: 'Amina Keza' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Amina Keza');

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.name).toBe('Amina Keza');
  });

  test('refuses an empty name', async () => {
    for (const name of ['', '   ', null]) {
      const res = await request(app).put('/api/auth/me').set('Authorization', student.auth).send({ name });
      expect(res.status).toBe(400);
    }
    const [row] = await q('SELECT name FROM users WHERE id = $1', [student.user.id]);
    expect(row.name).toBe('Test student');
  });

  test('cannot be used to change the role, email or anything else', async () => {
    // It must read the name and nothing else, or a profile form could make someone an admin.
    await request(app).put('/api/auth/me').set('Authorization', student.auth).send({
      name: 'Still Me', role: 'admin', email: 'hijack@alustudent.com', session_version: 999,
    });
    const [row] = await q('SELECT name, role, email FROM users WHERE id = $1', [student.user.id]);
    expect(row.name).toBe('Still Me');
    expect(row.role).toBe('student');
    expect(row.email).toBe('student.acct@alustudent.com');
  });
});

describe('POST /api/auth/change-email', () => {
  test('does not change the address until the new one is confirmed', async () => {
    const res = await changeEmail(student, 'new.address@alustudent.com');
    expect(res.status).toBe(200);

    const [row] = await q('SELECT email, pending_email, email_verified_at FROM users WHERE id = $1', [student.user.id]);
    expect(row.email).toBe('student.acct@alustudent.com'); // not changed yet
    expect(row.pending_email).toBe('new.address@alustudent.com');
    expect(row.email_verified_at).not.toBeNull();
    expect(await q("SELECT 1 FROM auth_tokens WHERE purpose = 'change_email'")).toHaveLength(1);
  });

  test('sends the confirmation link to the new address', async () => {
    const original = console.log;
    const logged = [];
    console.log = (...args) => logged.push(args.join(' '));
    try {
      await changeEmail(student, 'new.address@alustudent.com');
    } finally {
      console.log = original;
    }
    const mail = logged.join('\n');
    expect(mail).toContain('To:      new.address@alustudent.com');
    expect(mail).toMatch(/confirm-email-change\?token=\S+/);
  });

  test('needs the current password', async () => {
    // A stolen session alone must not be enough to move the email.
    const res = await changeEmail(student, 'new.address@alustudent.com', 'not-the-password');
    expect(res.status).toBe(401);
    const [row] = await q('SELECT pending_email FROM users WHERE id = $1', [student.user.id]);
    expect(row.pending_email).toBeNull();
  });

  test('holds students and staff to the ALU email domains', async () => {
    const res = await changeEmail(student, 'me@gmail.com');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/alustudent\.com|alueducation\.com/);
  });

  test('does not hold a legal expert to them, because experts are not ALU staff', async () => {
    const res = await changeEmail(expert, 'counsel@chambers.example');
    expect(res.status).toBe(200);
    const [row] = await q('SELECT pending_email FROM users WHERE id = $1', [expert.user.id]);
    expect(row.pending_email).toBe('counsel@chambers.example');
  });

  test('refuses an address another account already uses', async () => {
    const res = await changeEmail(student, 'other.acct@alustudent.com');
    expect(res.status).toBe(400);
  });

  test('refuses your own current address', async () => {
    const res = await changeEmail(student, 'student.acct@alustudent.com');
    expect(res.status).toBe(400);
  });

  test('refuses an email that is not text', async () => {
    const res = await changeEmail(expert, { not: 'text' });
    expect(res.status).toBe(400);
  });

  test('writes the address trimmed and in lowercase', async () => {
    await changeEmail(student, '  New.Address@ALUstudent.com  ');
    const [row] = await q('SELECT pending_email FROM users WHERE id = $1', [student.user.id]);
    expect(row.pending_email).toBe('new.address@alustudent.com');
  });
});

describe('POST /api/auth/confirm-email-change', () => {
  test('moves the address, clears the pending one and keeps the account verified', async () => {
    const raw = await startChange(student.user.id, 'confirmed@alustudent.com');
    const res = await request(app).post('/api/auth/confirm-email-change').send({ token: raw });

    expect(res.status).toBe(200);
    const [row] = await q('SELECT email, pending_email, email_verified_at FROM users WHERE id = $1', [student.user.id]);
    expect(row.email).toBe('confirmed@alustudent.com');
    expect(row.pending_email).toBeNull();
    expect(row.email_verified_at).not.toBeNull();
  });

  test('signs the person in again on the new address', async () => {
    const raw = await startChange(student.user.id, 'confirmed@alustudent.com');
    const res = await request(app).post('/api/auth/confirm-email-change').send({ token: raw });
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.email).toBe('confirmed@alustudent.com');
  });

  test('ends the other sessions, because moving the email is a way to take over an account', async () => {
    const raw = await startChange(student.user.id, 'confirmed2@alustudent.com');
    await request(app).post('/api/auth/confirm-email-change').send({ token: raw });
    expect((await request(app).get('/api/auth/me').set('Authorization', student.auth)).status).toBe(401);
  });

  test('a link cannot be used twice', async () => {
    const raw = await startChange(student.user.id, 'confirmed3@alustudent.com');
    expect((await request(app).post('/api/auth/confirm-email-change').send({ token: raw })).status).toBe(200);
    expect((await request(app).post('/api/auth/confirm-email-change').send({ token: raw })).status).toBe(400);
  });

  test('refuses when someone else took the address while the link sat in an inbox', async () => {
    const raw = await startChange(student.user.id, 'raced@alustudent.com');
    await q(`INSERT INTO users (name, email, password_hash, role, email_verified_at)
             VALUES ('Racer', 'raced@alustudent.com', 'x', 'student', now())`);

    const res = await request(app).post('/api/auth/confirm-email-change').send({ token: raw });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already/i);
    const [row] = await q('SELECT email, pending_email FROM users WHERE id = $1', [student.user.id]);
    expect(row.email).toBe('student.acct@alustudent.com');
    expect(row.pending_email).toBeNull();
  });

  test('a verification link does not confirm an email change', async () => {
    await q('UPDATE users SET pending_email = $1 WHERE id = $2', ['x@alustudent.com', student.user.id]);
    const raw = await issueToken(student.user.id, 'verify_email', 24);
    const res = await request(app).post('/api/auth/confirm-email-change').send({ token: raw });
    expect(res.status).toBe(400);
  });

  test('needs a token', async () => {
    expect((await request(app).post('/api/auth/confirm-email-change').send({})).status).toBe(400);
  });
});

describe('POST /api/auth/change-password', () => {
  test('changes the password, keeps this session and ends the others', async () => {
    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', student.auth)
      .send({ current_password: PASSWORD, new_password: 'a-much-better-password' });

    expect(res.status).toBe(200);
    // The old token stops working...
    expect((await request(app).get('/api/auth/me').set('Authorization', student.auth)).status).toBe(401);
    // ...and the new one works, so the person is not thrown out of the form.
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200);

    const login = await request(app).post('/api/auth/login')
      .send({ email: 'student.acct@alustudent.com', password: 'a-much-better-password' });
    expect(login.status).toBe(200);
  });

  test('needs the current password', async () => {
    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', student.auth)
      .send({ current_password: 'wrong', new_password: 'a-much-better-password' });
    expect(res.status).toBe(401);

    const login = await request(app).post('/api/auth/login')
      .send({ email: 'student.acct@alustudent.com', password: PASSWORD });
    expect(login.status).toBe(200); // the old password still works
  });

  test('holds the new password to the same minimum as registration', async () => {
    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', student.auth)
      .send({ current_password: PASSWORD, new_password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/);
  });

  test('can only change the password of the person who is signed in', async () => {
    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', other.auth)
      .send({ current_password: PASSWORD, new_password: 'a-much-better-password', user_id: student.user.id });
    expect(res.status).toBe(200);

    // The student's password is unchanged. The change went to the caller, not the id sent.
    const login = await request(app).post('/api/auth/login')
      .send({ email: 'student.acct@alustudent.com', password: PASSWORD });
    expect(login.status).toBe(200);
  });

  test('needs a session', async () => {
    const res = await request(app).post('/api/auth/change-password')
      .send({ current_password: PASSWORD, new_password: 'a-much-better-password' });
    expect(res.status).toBe(401);
  });
});

// Register, login, /me and role checks.
import express from 'express';
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { requireAuth } from '../../src/middleware/auth.js';
import { resetDb, makeUser } from '../helpers.js';

beforeEach(async () => {
  await resetDb();
});

const register = (overrides = {}) => request(app).post('/api/auth/register').send({
  name: 'Ada Student', email: 'ada@alustudent.com', password: 'password1234', role: 'student',
  ...overrides,
});

describe('POST /api/auth/register', () => {
  test('creates a student and returns a token and the user, never the password hash', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: 1, name: 'Ada Student', email: 'ada@alustudent.com', role: 'student' });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  test('stores the email trimmed and in lowercase', async () => {
    await register({ email: '  Ada@ALUStudent.com ' });
    const [row] = await q('SELECT email FROM users');
    expect(row.email).toBe('ada@alustudent.com');
  });

  test('does not let someone register as a legal expert or admin', async () => {
    for (const role of ['legal_expert', 'admin']) {
      const res = await register({ role });
      expect(res.status).toBe(400);
    }
  });

  test('rejects an email outside the ALU community', async () => {
    const res = await register({ email: 'ada@gmail.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ALU community/);
  });

  test('rejects a password under 8 characters', async () => {
    const res = await register({ password: 'short' });
    expect(res.status).toBe(400);
  });

  test('rejects an email that is already registered, whatever its casing or spaces', async () => {
    await register();
    const res = await register({ email: ' ADA@alustudent.com ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/);
  });

  test('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'ada@alustudent.com' });
    expect(res.status).toBe(400);
  });

  test('answers a password that is not text with a 400, not a 500', async () => {
    const res = await register({ password: 12345678 });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await register();
  });

  test('signs in with the right password, and the token works', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'ada@alustudent.com', password: 'password1234' });
    expect(res.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('ada@alustudent.com');
  });

  test('ignores casing and spaces in the email', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: ' ADA@alustudent.com ', password: 'password1234' });
    expect(res.status).toBe(200);
  });

  test('gives the same answer for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app).post('/api/auth/login')
      .send({ email: 'ada@alustudent.com', password: 'not-the-password' });
    const unknownEmail = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@alustudent.com', password: 'password1234' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  test('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ada@alustudent.com' });
    expect(res.status).toBe(400);
  });

  test('answers a password that is not text with a 400, not a 500', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'ada@alustudent.com', password: { $ne: '' } });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  test('needs a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Login required' });
  });

  test('rejects a token that is not valid', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired session' });
  });

  test('returns the user without the password hash', async () => {
    const student = await makeUser('student');
    const res = await request(app).get('/api/auth/me').set('Authorization', student.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: student.user.id, email: 'student@alustudent.com', role: 'student' });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
});

describe('requireAuth with roles', () => {
  // A small app with one admin-only route, so the check can be tested on its own.
  const guarded = express();
  guarded.get('/admin-only', requireAuth('admin'), (req, res) => res.json({ user: req.user }));

  test('lets the right role in and keeps the wrong one out', async () => {
    const student = await makeUser('student');
    const admin = await makeUser('admin');
    expect((await request(guarded).get('/admin-only').set('Authorization', student.auth)).status).toBe(403);
    expect((await request(guarded).get('/admin-only').set('Authorization', admin.auth)).status).toBe(200);
  });

  test('takes the role from the database, not from the token', async () => {
    const admin = await makeUser('admin');
    await q("UPDATE users SET role = 'student' WHERE id = $1", [admin.user.id]);
    const res = await request(guarded).get('/admin-only').set('Authorization', admin.auth);
    expect(res.status).toBe(403);
  });

  test('refuses a token whose account no longer exists', async () => {
    const admin = await makeUser('admin');
    await q('DELETE FROM users WHERE id = $1', [admin.user.id]);
    const res = await request(guarded).get('/admin-only').set('Authorization', admin.auth);
    expect(res.status).toBe(401);
  });
});

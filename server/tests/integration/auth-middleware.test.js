import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { q } from '../../src/db.js';
import {
  requireAuth, optionalAuth, signToken, revokeSessions, getSecret,
} from '../../src/middleware/auth.js';
import { resetDb, makeUser } from '../helpers.js';

// A small app with one route of each kind, so only the middleware is under test.
const app = express();
app.get('/me', requireAuth(), (req, res) => res.json(req.user));
app.get('/admin', requireAuth('admin'), (_req, res) => res.json({ ok: true }));
app.get('/open', optionalAuth, (req, res) => res.json({ user: req.user ?? null }));

beforeEach(resetDb);

const reload = async (id) => (await q('SELECT * FROM users WHERE id = $1', [id]))[0];

describe('requireAuth', () => {
  it('asks for a login when there is no token', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Login required' });
  });

  it('refuses a token that is not a token', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired session' });
  });

  it('refuses a token signed with a different secret', async () => {
    const { user } = await makeUser('student');
    const forged = jwt.sign({ id: user.id, role: 'admin', sv: 0 }, 'a-different-secret-that-is-long-enough-123');
    const res = await request(app).get('/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('refuses an expired token', async () => {
    const { user } = await makeUser('student');
    const old = jwt.sign({ id: user.id, role: 'student', sv: 0 }, getSecret(), { expiresIn: -10 });
    const res = await request(app).get('/me').set('Authorization', `Bearer ${old}`);
    expect(res.status).toBe(401);
  });

  it('lets a valid token through and sets req.user from the database', async () => {
    const { user, auth } = await makeUser('student');
    const res = await request(app).get('/me').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: user.id, role: 'student', name: 'Test student' });
  });

  it('refuses a role that is not allowed with a 403', async () => {
    const { auth } = await makeUser('student');
    const res = await request(app).get('/admin').set('Authorization', auth);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permission/i);
  });

  it('reads the role from the database and not from the token', async () => {
    const { user, auth } = await makeUser('student');
    await q("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
    const promoted = await request(app).get('/admin').set('Authorization', auth);
    expect(promoted.status).toBe(200);

    await q("UPDATE users SET role = 'student' WHERE id = $1", [user.id]);
    const demoted = await request(app).get('/admin').set('Authorization', auth);
    expect(demoted.status).toBe(403);
  });

  it('ends every token the account holds when the sessions are revoked', async () => {
    const { user, auth } = await makeUser('student');
    await revokeSessions(user.id);
    const old = await request(app).get('/me').set('Authorization', auth);
    expect(old.status).toBe(401);

    const fresh = `Bearer ${signToken(await reload(user.id))}`;
    const again = await request(app).get('/me').set('Authorization', fresh);
    expect(again.status).toBe(200);
  });

  it('ends the session of an account that was switched off', async () => {
    const { user, auth } = await makeUser('student');
    await q('UPDATE users SET deactivated_at = now() WHERE id = $1', [user.id]);
    const res = await request(app).get('/me').set('Authorization', auth);
    expect(res.status).toBe(401);
  });

  it('refuses a token for an account that no longer exists', async () => {
    const { user, auth } = await makeUser('student');
    await q('DELETE FROM users WHERE id = $1', [user.id]);
    const res = await request(app).get('/me').set('Authorization', auth);
    expect(res.status).toBe(401);
  });

  it('refuses a token with no session number', async () => {
    const { user } = await makeUser('student');
    const old = jwt.sign({ id: user.id, role: 'student' }, getSecret());
    const res = await request(app).get('/me').set('Authorization', `Bearer ${old}`);
    expect(res.status).toBe(401);
  });
});

describe('optionalAuth', () => {
  it('treats no token as a visitor', async () => {
    const res = await request(app).get('/open');
    expect(res.body).toEqual({ user: null });
  });

  it('treats a bad token as a visitor and does not refuse it', async () => {
    const res = await request(app).get('/open').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it('knows a signed-in person', async () => {
    const { user, auth } = await makeUser('staff');
    const res = await request(app).get('/open').set('Authorization', auth);
    expect(res.body.user.id).toBe(user.id);
  });
});

describe('signToken and getSecret', () => {
  it('will not make a token that could never be ended', () => {
    expect(() => signToken({ id: 1, role: 'student', name: 'X' })).toThrow(/session_version/);
  });

  it('stops when the secret is missing, short or a known weak value', () => {
    const original = process.env.JWT_SECRET;
    try {
      for (const bad of [undefined, 'short', 'dev-secret', 'change-me-in-production']) {
        if (bad === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = bad;
        expect(() => getSecret()).toThrow(/JWT_SECRET/);
      }
    } finally {
      process.env.JWT_SECRET = original;
    }
  });
});

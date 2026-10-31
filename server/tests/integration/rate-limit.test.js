import express from 'express';
import request from 'supertest';
import { createLimiter, loginEmailLimiter } from '../../src/middleware/rateLimit.js';

// The limits are off in tests unless this is set. See src/middleware/rateLimit.js.
beforeAll(() => { process.env.RATE_LIMIT_TEST = '1'; });
afterAll(() => { delete process.env.RATE_LIMIT_TEST; });

describe('createLimiter', () => {
  it('answers 429 with a JSON message once the limit is passed', async () => {
    const app = express();
    app.get('/x', createLimiter({ max: 2, message: 'Slow down.' }), (_req, res) => res.json({ ok: true }));

    expect((await request(app).get('/x')).status).toBe(200);
    expect((await request(app).get('/x')).status).toBe(200);
    const blocked = await request(app).get('/x');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'Slow down.' });
  });

  it('tells the browser how many tries are left', async () => {
    const app = express();
    app.get('/x', createLimiter({ max: 5, message: 'Slow down.' }), (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/x');
    expect(res.headers['ratelimit-limit']).toBe('5');
    expect(res.headers['ratelimit-remaining']).toBe('4');
  });

  it('does nothing when the tests have not switched it on', async () => {
    delete process.env.RATE_LIMIT_TEST;
    try {
      const app = express();
      app.get('/x', createLimiter({ max: 1, message: 'Slow down.' }), (_req, res) => res.json({ ok: true }));
      expect((await request(app).get('/x')).status).toBe(200);
      expect((await request(app).get('/x')).status).toBe(200);
    } finally {
      process.env.RATE_LIMIT_TEST = '1';
    }
  });
});

describe('loginEmailLimiter', () => {
  // The route answers the way the real login will: 401 for a wrong password, 403 for an
  // unverified address and 200 for success.
  const app = express();
  app.use(express.json());
  app.post('/login', loginEmailLimiter, (req, res) => {
    if (req.body.password === 'right') return res.json({ ok: true });
    if (req.body.password === 'unverified') return res.status(403).json({ error: 'not verified' });
    res.status(401).json({ error: 'wrong' });
  });
  const login = (email, password) => request(app).post('/login').send({ email, password });

  it('blocks an email after 10 wrong passwords and leaves other emails alone', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await login('guess@example.org', 'wrong')).status).toBe(401);
    }
    const blocked = await login('guess@example.org', 'wrong');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many attempts/i);

    expect((await login('someone-else@example.org', 'wrong')).status).toBe(401);
  });

  it('does not count good logins', async () => {
    for (let i = 0; i < 15; i += 1) {
      expect((await login('good@example.org', 'right')).status).toBe(200);
    }
  });

  it('does not count a 403 for an unverified address', async () => {
    for (let i = 0; i < 15; i += 1) {
      expect((await login('waiting@example.org', 'unverified')).status).toBe(403);
    }
    expect((await login('waiting@example.org', 'wrong')).status).toBe(401);
  });

  it('counts the email in any letter case as the same email', async () => {
    for (let i = 0; i < 10; i += 1) {
      await login('Mixed@Example.org', 'wrong');
    }
    expect((await login('  mixed@example.org ', 'wrong')).status).toBe(429);
  });
});

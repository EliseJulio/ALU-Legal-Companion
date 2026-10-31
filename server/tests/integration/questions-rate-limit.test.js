import request from 'supertest';
import app from '../../src/app.js';
import { resetDb } from '../helpers.js';

// The limits are off in tests unless this is set. See src/middleware/rateLimit.js.
beforeAll(() => { process.env.RATE_LIMIT_TEST = '1'; });
afterAll(() => { delete process.env.RATE_LIMIT_TEST; });

beforeEach(resetDb);

describe('the limits on anonymous questions', () => {
  it('stops the 31st anonymous question from one address in an hour', async () => {
    for (let i = 0; i < 30; i += 1) {
      const res = await request(app).post('/api/questions/anonymous').send({ text: `Question ${i}` });
      expect(res.status).toBe(201);
    }
    const blocked = await request(app).post('/api/questions/anonymous').send({ text: 'One too many' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many submissions/);
  });

  it('stops the 101st token lookup from one address in 15 minutes', async () => {
    for (let i = 0; i < 100; i += 1) {
      expect((await request(app).get('/api/questions/anon/1234-5678-9ABC-DEF0')).status).toBe(404);
    }
    const blocked = await request(app).get('/api/questions/anon/1234-5678-9ABC-DEF0');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many lookups/);
  });

  it('does not use up the booking limits', async () => {
    for (let i = 0; i < 30; i += 1) {
      await request(app).post('/api/questions/anonymous').send({ text: `Question ${i}` });
    }
    const res = await request(app).get('/api/bookings/anon/1234-5678-9ABC-DEF0');
    expect(res.status).toBe(404);
  });
});

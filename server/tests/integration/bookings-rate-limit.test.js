import request from 'supertest';
import app from '../../src/app.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

// The limits are off in tests unless this is set. See src/middleware/rateLimit.js.
beforeAll(() => { process.env.RATE_LIMIT_TEST = '1'; });
afterAll(() => { delete process.env.RATE_LIMIT_TEST; });

let provider;
beforeEach(async () => {
  await resetDb();
  const expert = await makeUser('legal_expert');
  provider = await makeProvider(
    { user_id: expert.user.id, bookable: true, meet_link: 'https://meet.google.com/aaa-bbbb-ccc' },
    { verifiedBy: expert.user.id });
});

describe('the limits on anonymous bookings', () => {
  it('stops the 31st anonymous booking from one address in an hour', async () => {
    const slot = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    for (let i = 0; i < 30; i += 1) {
      const res = await request(app).post('/api/bookings/anonymous').send({ provider_id: provider.id, slot });
      expect(res.status).toBe(201);
    }
    const blocked = await request(app).post('/api/bookings/anonymous').send({ provider_id: provider.id, slot });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many submissions/);
  });

  it('stops the 101st token lookup from one address in 15 minutes', async () => {
    for (let i = 0; i < 100; i += 1) {
      const res = await request(app).get('/api/bookings/anon/AAAA-BBBB-CCCC');
      expect(res.status).toBe(404);
    }
    const blocked = await request(app).get('/api/bookings/anon/AAAA-BBBB-CCCC');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many lookups/);
  });
});

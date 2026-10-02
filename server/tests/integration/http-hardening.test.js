// HTTP hardening: security headers, the CORS allowlist and the request body limit.
import request from 'supertest';
import app from '../../src/app.js';

describe('security headers', () => {
  test('every response carries x-content-type-options: nosniff', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('CORS allowlist', () => {
  test('an origin that is not listed is not allowed and not wildcarded', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(200); // the header is just left out, the request is not rejected
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  test('the listed origin is allowed', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('a request with no Origin header still works', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('a browser can read the rate-limit headers', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    const exposed = (res.headers['access-control-expose-headers'] || '').split(',').map((h) => h.trim());
    expect(exposed).toEqual(expect.arrayContaining(['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After']));
  });
});

describe('request body limit', () => {
  test('a body over 100kb gets a 413, not a 500', async () => {
    const res = await request(app)
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send({ text: 'A'.repeat(150 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'That request is too large.' });
  });
});

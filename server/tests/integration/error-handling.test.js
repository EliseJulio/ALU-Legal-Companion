// Errors always come back as { error: "message" } and never leak internals.
import request from 'supertest';
import app from '../../src/app.js';

function expectNoLeak(body) {
  const text = JSON.stringify(body).toLowerCase();
  expect(text).not.toContain('stack');
  expect(text).not.toContain('syntax');
  expect(text).not.toMatch(/[a-z]:\\/i); // a Windows file path
  expect(text).not.toMatch(/\/(home|usr|src)\//); // a Linux file path
}

describe('malformed JSON', () => {
  test('is a clean 400, not a 500', async () => {
    const res = await request(app)
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send('{not valid json');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON in request body.' });
    expectNoLeak(res.body);
  });
});

describe('unknown paths', () => {
  test('get the JSON error format, not Express\'s HTML page', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(res.type).toBe('application/json');
    expectNoLeak(res.body);
  });

  test('the catch-all does not swallow a real route', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

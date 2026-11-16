import request from 'supertest';
import app from '../../src/app.js';

// Every error is a small JSON message a person can act on. None carries a stack trace.
describe('how the API reports errors', () => {
  it('answers a path nothing matched with a JSON message and not a web page', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('answers broken JSON with a 400 and a plain message', async () => {
    const res = await request(app).post('/api/health').set('Content-Type', 'application/json').send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON in request body.' });
  });

  it('refuses a body over 100 kb', async () => {
    const res = await request(app).post('/api/health').set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(150 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large/i);
  });

  it('sends only an error message, never a stack trace or a file path', async () => {
    const bodies = [
      (await request(app).get('/api/guides/abc')).body,
      (await request(app).post('/api/auth/login').send({})).body,
      (await request(app).get('/api/auth/me')).body,
    ];
    for (const body of bodies) {
      expect(Object.keys(body)).toEqual(['error']);
      expect(body.error).not.toMatch(/\bat\s.+\.js|node_modules|stack/i);
    }
  });
});

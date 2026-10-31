import request from 'supertest';
import app from '../../src/app.js';

describe('the app', () => {
  it('answers a health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers a path nothing matched with a JSON error and not a web page', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('answers broken JSON with a 400 and a message', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON in request body.' });
  });

  it('refuses a body over 100 kb', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(150 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large/i);
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('lets the Vite dev server call it and nobody else', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const other = await request(app).get('/api/health').set('Origin', 'https://other.example.org');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

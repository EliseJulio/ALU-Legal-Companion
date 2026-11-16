import http from 'node:http';
import request from 'supertest';
import app from '../../src/app.js';
import { resetDb, makeUser, makeGuide } from '../helpers.js';

// Google is replaced by a small local server. Each test says what it answers. No real call is made.
let stub;
let reply = { status: 200, body: {} };
let seen = 0;
const saved = {};
const KEYS = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_API_BASE'];

beforeAll(async () => {
  stub = http.createServer((req, res) => {
    seen += 1;
    res.writeHead(reply.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(reply.body));
  });
  await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve));
  KEYS.forEach((k) => { saved[k] = process.env[k]; });
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'test-model';
  process.env.GEMINI_API_BASE = `http://127.0.0.1:${stub.address().port}`;
});

afterAll(async () => {
  KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
  await new Promise((resolve) => stub.close(resolve));
});

beforeEach(async () => {
  await resetDb();
  seen = 0;
  const admin = await makeUser('admin');
  await makeGuide({
    title: 'Getting your deposit back',
    situation: 'Your landlord kept your rental deposit after you moved out.',
    law_says: 'The landlord must return the deposit. An Abunzi committee can hear claims up to Frw 3,000,000.',
  }, { verifiedBy: admin.user.id });
});

const modelSays = (text) => ({ status: 200, body: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] } });
const ask = (question = 'Does my landlord have to return my deposit?') => request(app).post('/api/ask-ai').send({ question });

// The Ask AI limit is five requests a minute from one address. This file stays inside it.
describe('POST /api/ask-ai', () => {
  it('answers from the published guide and names it as the source', async () => {
    reply = modelSays('The landlord must return the deposit.');
    const res = await ask();
    expect(res.status).toBe(200);
    expect(res.body.answered).toBe(true);
    expect(res.body.answer).toMatch(/return the deposit/);
    expect(res.body.sources.map((s) => s.title)).toEqual(['Getting your deposit back']);
  });

  it('says the limit was reached with a 429 and a retry time when Google answers 429', async () => {
    reply = { status: 429, body: { error: { message: 'You exceeded your current quota' } } };
    const res = await ask();
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('120');
    expect(res.body.error).toMatch(/reached its limit/);
    // Nothing from Google is passed on.
    expect(JSON.stringify(res.body)).not.toMatch(/quota/i);
  });

  it('says it is busy for a moment with a 503 when Google is overloaded', async () => {
    reply = { status: 503, body: { error: { message: 'high demand' } } };
    const res = await ask();
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/busy/);
  });

  it('gives nothing away for any other failure', async () => {
    reply = { status: 404, body: { error: { message: 'model gone' } } };
    const res = await ask();
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Ask AI is not available right now.');
  });

  it('refuses an answer that holds a figure the guide does not have', async () => {
    reply = modelSays('The landlord must return the deposit within 45 days.');
    const res = await ask();
    expect(res.status).toBe(200);
    expect(res.body.answered).toBe(false);
    expect(seen).toBe(1);
  });
});

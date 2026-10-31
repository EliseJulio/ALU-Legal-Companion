import express from 'express';
import request from 'supertest';
import { isValidId, requireIntParam } from '../../src/middleware/validate.js';

describe('isValidId', () => {
  it('accepts whole numbers from 1 to 2147483647, as numbers or as digit strings', () => {
    expect(isValidId(1)).toBe(true);
    expect(isValidId('42')).toBe(true);
    expect(isValidId(2147483647)).toBe(true);
    expect(isValidId('2147483647')).toBe(true);
  });

  it('refuses anything else', () => {
    for (const bad of [0, -1, 1.5, 2147483648, '0', '-1', '1.5', '12abc', '', ' 1', null, undefined, {}, [], true]) {
      expect(isValidId(bad)).toBe(false);
    }
  });
});

describe('requireIntParam', () => {
  const app = express();
  app.get('/things/:id', requireIntParam('id'), (req, res) => res.json({ id: req.params.id, type: typeof req.params.id }));

  it('puts the number back in req.params', async () => {
    const res = await request(app).get('/things/7');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 7, type: 'number' });
  });

  it('answers 404 and not 400 for a bad id, because a bad address is the same as a missing thing', async () => {
    for (const bad of ['abc', '0', '-3', '2147483648', '1.5']) {
      const res = await request(app).get(`/things/${bad}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    }
  });
});

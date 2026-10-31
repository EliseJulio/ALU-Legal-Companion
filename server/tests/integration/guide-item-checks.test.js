// The lawyer line-by-line fee/document/office check feature (PUT /api/guides/:id/item-checks)
// was removed: legal experts no longer verify or check guide content, per the supervisor's
// decision to limit them to consultations and matter-document review.
import request from 'supertest';
import app from '../../src/app.js';
import { resetDb, makeUser } from '../helpers.js';

beforeEach(resetDb);

it('no longer has an item-checks endpoint for guides', async () => {
  const admin = await makeUser('admin');
  const res = await request(app).put('/api/guides/1/item-checks').set('Authorization', admin.auth).send({});
  expect(res.status).toBe(404);
});

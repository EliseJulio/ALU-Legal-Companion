// The areas of law ("domains") are written one way only.
// A guide saved as "Harassment" would not be found by the "harassment" filter button so
// it would be published but impossible to find by browsing.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, guideBody } from '../helpers.js';

let admin;
let expert;

beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin', 'admin@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
});

// Publishes a guide, so it shows in the public list where the filter is used.
async function publish(body) {
  const created = await request(app).post('/api/guides').set('Authorization', admin.auth).send(body);
  expect(created.status).toBe(201);
  await request(app).post(`/api/guides/${created.body.id}/submit`).set('Authorization', admin.auth).expect(200);
  await request(app).post(`/api/guides/${created.body.id}/verify`).set('Authorization', expert.auth).expect(200);
  return created.body;
}

describe('guide domains', () => {
  test('a domain typed with capital letters is saved in lowercase', async () => {
    const created = await request(app).post('/api/guides').set('Authorization', admin.auth)
      .send(guideBody({ domain: 'Harassment' }));
    expect(created.status).toBe(201);
    expect(created.body.domain).toBe('harassment');
    const [row] = await q('SELECT domain FROM guides WHERE id = $1', [created.body.id]);
    expect(row.domain).toBe('harassment');
  });

  test('spaces around the domain are removed', async () => {
    const created = await request(app).post('/api/guides').set('Authorization', admin.auth)
      .send(guideBody({ domain: '  tenancy ' }));
    expect(created.body.domain).toBe('tenancy');
  });

  test('a guide saved with capital letters is found by the lowercase filter', async () => {
    const guide = await publish(guideBody({ domain: 'Harassment', title: 'Reporting harassment at work' }));
    const filtered = await request(app).get('/api/guides?domain=harassment');
    expect(filtered.body.map((g) => g.id)).toContain(guide.id);
  });

  test('the filter ignores capital letters too', async () => {
    const guide = await publish(guideBody({ domain: 'tenancy', title: 'Getting your deposit back' }));
    const filtered = await request(app).get('/api/guides?domain=Tenancy');
    expect(filtered.body.map((g) => g.id)).toContain(guide.id);
  });

  test('an unknown domain is refused, and the answer lists the real ones', async () => {
    const res = await request(app).post('/api/guides').set('Authorization', admin.auth)
      .send(guideBody({ domain: 'famly' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenancy/);
    expect(res.body.error).toMatch(/harassment/);
  });

  test('editing a guide cleans the domain too', async () => {
    const created = await request(app).post('/api/guides').set('Authorization', admin.auth)
      .send(guideBody({ domain: 'tenancy' }));
    const edited = await request(app).put(`/api/guides/${created.body.id}`)
      .set('Authorization', admin.auth).send({ domain: 'IMMIGRATION' });
    expect(edited.status).toBe(200);
    expect(edited.body.domain).toBe('immigration');
  });

  test('an edit with an unknown domain is refused and the guide stays published', async () => {
    // The domain is checked before saving. Otherwise a typo would take a verified guide
    // off the site and change nothing.
    const guide = await publish(guideBody({ domain: 'tenancy', title: 'Deposit rules' }));
    const res = await request(app).put(`/api/guides/${guide.id}`)
      .set('Authorization', admin.auth).send({ domain: 'nonsense' });
    expect(res.status).toBe(400);

    const [row] = await q('SELECT status, verified_at FROM guides WHERE id = $1', [guide.id]);
    expect(row.status).toBe('published');
    expect(row.verified_at).not.toBeNull();
  });
});

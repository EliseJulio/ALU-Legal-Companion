import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeGuide, guideBody } from '../helpers.js';

// The "how to do it" part of a guide. Fees, documents, offices and steps are the facts that go
// stale. So they follow the same rule as the text. Any edit sends the guide back to draft.

let admin;
let expert;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
  expert = await makeUser('legal_expert');
});

const service = (overrides = {}) => ({
  portal: { name: 'IremboGov', url: 'https://irembo.gov.rw/user/citizen/service/dgie/request_a_permit' },
  who_can_apply: 'A foreign student with a Class U1 permit.',
  fees: [{ item: 'Student permit (Class U1)', amount_rwf: 20000 }, { item: 'Express handling', amount_rwf: null }],
  processing: { text: '7 days for permit renewals in general' },
  documents: [{ name: 'Passport biodata page' }, { name: 'Recommendation letter' }],
  offices: [{ name: 'DGIE head office', address: 'KG 7 Ave, Kigali' }],
  walkthrough: [{ instruction: 'Choose Permits.' }],
  unconfirmed: ['How many days before expiry to apply'],
  checked_at: '2026-10-20',
  ...overrides,
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const create = (body) => as(admin, 'post', '/api/guides').send(body);
const edit = (id, body) => as(admin, 'put', `/api/guides/${id}`).send(body);
const publish = (who, id) => as(who, 'post', `/api/guides/${id}/publish`).send({});
const staffGuide = async (id) => (await as(admin, 'get', '/api/guides/all')).body.find((g) => g.id === id);
async function publishedWithService() {
  const created = await create(guideBody({ title: 'Renew a permit', service: service() }));
  expect(created.status).toBe(201);
  await publish(admin, created.body.id).expect(200);
  return created.body;
}

describe('saving a service block', () => {
  it('is stored with the guide and shown to a reader once the guide is published', async () => {
    const guide = await publishedWithService();
    const res = await request(app).get(`/api/guides/${guide.id}`);
    expect(res.status).toBe(200);
    expect(res.body.service.fees[0]).toEqual({ item: 'Student permit (Class U1)', amount_rwf: 20000 });
    // An unknown fee is kept as null. It is never stored as zero.
    expect(res.body.service.fees[1].amount_rwf).toBeNull();
    expect(res.body.service.documents.map((d) => d.name)).toEqual(['Passport biodata page', 'Recommendation letter']);
  });

  it('is optional. A guide with no block still saves and shows null', async () => {
    const created = await create(guideBody());
    expect(created.status).toBe(201);
    expect((await staffGuide(created.body.id)).service).toBeNull();
  });

  it('is hidden from the public until the guide is published', async () => {
    const created = await create(guideBody({ service: service() }));
    expect((await request(app).get(`/api/guides/${created.body.id}`)).status).toBe(404);
    expect((await staffGuide(created.body.id)).service.portal.name).toBe('IremboGov');
  });

  it('is accepted for the vehicles area of law', async () => {
    const created = await create(guideBody({ domain: 'vehicles', title: 'Buying a car', service: service() }));
    expect(created.status).toBe(201);
    expect(created.body.domain).toBe('vehicles');
  });

  it('shows on the list only as a flag, never as the block itself', async () => {
    const guide = await publishedWithService();
    await makeGuide({ title: 'Plain' }, { verifiedBy: expert.user.id });
    const rows = (await request(app).get('/api/guides')).body;
    expect(rows.find((g) => g.id === guide.id).has_service).toBe(true);
    expect(rows.find((g) => g.title === 'Plain').has_service).toBe(false);
    expect(rows.every((g) => !('service' in g))).toBe(true);
  });
});

describe('what the server refuses', () => {
  it.each([
    ['a link that is not https', { portal: { url: 'http://irembo.gov.rw/x' } }, /portal\.url/],
    ['a javascript link', { fees: [{ item: 'Fee', source_url: 'javascript:alert(1)' }] }, /fees\[0\]\.source_url/],
    ['a field nobody planned for', { colour: 'red' }, /unknown field "colour"/],
    ['a fee with no name', { fees: [{ amount_rwf: 5 }] }, /fees\[0\]\.item/],
    ['a negative fee', { fees: [{ item: 'Fee', amount_rwf: -1 }] }, /whole number/],
    ['a date that does not exist', { checked_at: '2026-02-30' }, /checked_at/],
    ['a walkthrough step with no instruction', { walkthrough: [{ url_at_step: 'https://irembo.gov.rw/x' }] }, /walkthrough\[0\]\.instruction/],
  ])('refuses %s and names the field', async (_name, bad, pattern) => {
    const res = await create(guideBody({ service: service(bad) }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Service details:/);
    expect(res.body.error).toMatch(pattern);
  });
});

describe('the integrity rule', () => {
  it('an edit to the block sends a published guide back to draft and clears the stamp', async () => {
    const guide = await publishedWithService();
    const svc = service();
    svc.fees[0].amount_rwf = 25000;
    const res = await edit(guide.id, { service: svc });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body).not.toHaveProperty('verified_by_name');
    expect((await request(app).get(`/api/guides/${guide.id}`)).status).toBe(404);
  });

  it('leaving the key out keeps the block. Sending null clears it', async () => {
    const guide = await publishedWithService();
    await edit(guide.id, { title: 'A new title' });
    expect((await staffGuide(guide.id)).service.portal.name).toBe('IremboGov');
    await edit(guide.id, { service: null });
    expect((await staffGuide(guide.id)).service).toBeNull();
  });

  it('a bad block is refused before anything changes, so a published guide stays published', async () => {
    const guide = await publishedWithService();
    const res = await edit(guide.id, { service: service({ portal: { url: 'http://not-secure.example' } }) });
    expect(res.status).toBe(400);
    expect((await request(app).get(`/api/guides/${guide.id}`)).status).toBe(200);
    expect((await q('SELECT status FROM guides WHERE id = $1', [guide.id]))[0].status).toBe('published');
  });

  it('only an admin can write a block or publish it', async () => {
    const student = await makeUser('student');
    expect((await as(student, 'post', '/api/guides').send(guideBody({ service: service() }))).status).toBe(403);
    expect((await as(expert, 'post', '/api/guides').send(guideBody({ service: service() }))).status).toBe(403);
    const created = await create(guideBody({ service: service() }));
    expect((await publish(expert, created.body.id)).status).toBe(403);
    expect((await publish(student, created.body.id)).status).toBe(403);
    expect((await publish(admin, created.body.id)).status).toBe(200);
  });
});

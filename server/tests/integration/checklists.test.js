import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser } from '../helpers.js';

// Document checklists. The admin writes a draft and publishes it directly. Any edit sends a
// published checklist back to draft. Legal experts no longer verify or publish anything.

let admin;
let expert;
let student;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
  expert = await makeUser('legal_expert');
  student = await makeUser('student');
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const item = (over = {}) => ({ key: 'yellow-card', name: 'Yellow card', ...over });
const body = (over = {}) => ({ slug: 'buying-a-car', title: 'Buying a car', description: 'What RRA asks for.', items: [item(), item({ key: 'tin', name: 'TIN' })], ...over });
const create = (over) => as(admin, 'post', '/api/checklists').send(body(over));
const publish = (id, who = admin) => as(who, 'post', `/api/checklists/${id}/publish`).send({});
const edit = (id, over) => as(admin, 'put', `/api/checklists/${id}`).send(over);

async function published() {
  const c = (await create()).body;
  await publish(c.id).expect(200);
  return c;
}

describe('writing a checklist', () => {
  it('saves a draft with every item marked required unless it says otherwise', async () => {
    const res = await create({ items: [item(), item({ key: 'ebm', name: 'EBM invoice', required: false, required_if: 'the seller is VAT-registered' })] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'draft', verified_by: null });
    expect(res.body.items.map((i) => i.required)).toEqual([true, false]);
  });

  it.each([
    ['a slug with capitals', { slug: 'Buying A Car' }, /slug/],
    ['no title', { title: '' }, /title/],
    ['no documents', { items: [] }, /at least one document/],
    ['a document with no name', { items: [{ key: 'a' }] }, /items\[0\]\.name/],
    ['two documents with the same key', { items: [item(), item()] }, /used twice/],
    ['a link that is not https', { items: [item({ source_url: 'http://rra.gov.rw' })] }, /source_url/],
    ['a javascript link', { items: [item({ source_url: 'javascript:alert(1)' })] }, /source_url/],
    ['a field nobody planned for', { items: [item({ colour: 'red' })] }, /unknown field "colour"/],
    ['a required flag that is not true or false', { items: [item({ required: 'no' })] }, /required/],
  ])('refuses %s and names the problem', async (_name, over, pattern) => {
    const res = await create(over);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(pattern);
  });

  it('refuses a name that is already used', async () => {
    await create();
    const res = await create();
    expect(res.status).toBe(409);
  });

  it('is for the admin only', async () => {
    expect((await as(expert, 'post', '/api/checklists').send(body())).status).toBe(403);
    expect((await as(student, 'post', '/api/checklists').send(body())).status).toBe(403);
    expect((await request(app).post('/api/checklists').send(body())).status).toBe(401);
  });
});

describe('what the public sees', () => {
  it('lists published checklists only and never a draft', async () => {
    await create({ slug: 'a-draft', title: 'A draft' });
    const toPublish = (await create({ slug: 'buying-a-car-2', title: 'Buying a car 2' })).body;
    expect((await request(app).get('/api/checklists')).body).toEqual([]);
    await publish(toPublish.id).expect(200);
    const list = (await request(app).get('/api/checklists')).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: 'Buying a car 2', item_count: 2 });
    expect(list[0]).not.toHaveProperty('items');
  });

  it('shows the whole list and who published it once it is published', async () => {
    const c = await published();
    const res = await request(app).get(`/api/checklists/${c.id}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body).not.toHaveProperty('verified_by_name');
    expect(res.body).not.toHaveProperty('status');
    expect(res.body).not.toHaveProperty('verified_by');
  });

  it('answers 404 for a draft and for a checklist that does not exist', async () => {
    const draft = (await create()).body;
    expect((await request(app).get(`/api/checklists/${draft.id}`)).status).toBe(404);
    expect((await request(app).get('/api/checklists/99999')).status).toBe(404);
  });

  it('shows every checklist in every state to the admin only', async () => {
    await create();
    expect((await as(admin, 'get', '/api/checklists/all')).body).toHaveLength(1);
    expect((await as(expert, 'get', '/api/checklists/all')).status).toBe(403);
    expect((await as(student, 'get', '/api/checklists/all')).status).toBe(403);
    expect((await request(app).get('/api/checklists/all')).status).toBe(401);
  });
});

describe('the integrity rule', () => {
  it('an edit to a published checklist sends it back to draft and clears the stamp', async () => {
    const c = await published();
    const res = await edit(c.id, { title: 'Buying a car in Kigali' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'draft', verified_by: null, verified_at: null });
    expect((await request(app).get(`/api/checklists/${c.id}`)).status).toBe(404);
  });

  it('a field the request leaves out keeps its value', async () => {
    const c = await published();
    const res = await edit(c.id, { description: 'A new description.' });
    expect(res.body.title).toBe('Buying a car');
    expect(res.body.items).toHaveLength(2);
  });

  it('a bad edit is refused before anything changes. So a published checklist stays published', async () => {
    const c = await published();
    const res = await edit(c.id, { items: [] });
    expect(res.status).toBe(400);
    expect((await request(app).get(`/api/checklists/${c.id}`)).status).toBe(200);
  });

  it('the database refuses a published checklist with no verifier', async () => {
    const c = (await create()).body;
    await expect(q("UPDATE document_checklists SET status = 'published' WHERE id = $1", [c.id]))
      .rejects.toThrow(/document_checklists_published_is_verified/);
  });

  it('a legal expert cannot publish and cannot edit', async () => {
    const c = (await create()).body;
    expect((await publish(c.id, expert)).status).toBe(403);
    expect((await as(expert, 'put', `/api/checklists/${c.id}`).send({ title: 'x' })).status).toBe(403);
  });
});

describe('publishing a checklist', () => {
  it('is for the admin only, never a legal expert or a student', async () => {
    const c = (await create()).body;
    expect((await publish(c.id, expert)).status).toBe(403);
    expect((await publish(c.id, student)).status).toBe(403);
    expect((await publish(c.id, admin)).status).toBe(200);
  });

  it('stamps the admin', async () => {
    const c = (await create()).body;
    const res = await publish(c.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'published', verified_by: admin.user.id });
  });

  it('refuses a checklist that is already published', async () => {
    const c = await published();
    expect((await publish(c.id)).status).toBe(400);
  });

  it('answers 400 for a checklist that does not exist', async () => {
    expect((await publish(99999)).status).toBe(400);
  });
});

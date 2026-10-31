import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { BUILT_IN_CONTACTS } from '../../src/routes/contacts.js';
import { resetDb, makeUser } from '../helpers.js';

let admin;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
});

const as = (method, path) => request(app)[method](path).set('Authorization', admin.auth);
const NEW_CONTACT = { name: 'Campus Counselling', contact: '0788000000', when_to_use: 'When you need to talk' };
const publicList = async () => (await request(app).get('/api/emergency-contacts')).body;

describe('POST /api/admin/emergency-contacts', () => {
  it('adds a contact and the public list shows it', async () => {
    const res = await as('post', '/api/admin/emergency-contacts').send(NEW_CONTACT);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...NEW_CONTACT, sort_order: 100 });
    expect(await publicList()).toEqual([{ name: 'Campus Counselling', contact: '0788000000', when: 'When you need to talk' }]);
  });

  it('trims the text and takes the order that was sent', async () => {
    const res = await as('post', '/api/admin/emergency-contacts')
      .send({ name: '  Police  ', contact: ' 112 ', when_to_use: ' Danger ', sort_order: 1 });
    expect(res.body).toMatchObject({ name: 'Police', contact: '112', when_to_use: 'Danger', sort_order: 1 });
  });

  it.each([
    ['no name', { name: undefined }],
    ['a blank number', { contact: '   ' }],
    ['no reason', { when_to_use: '' }],
    ['text that is not text', { name: 42 }],
    ['a name that is too long', { name: 'x'.repeat(201) }],
    ['a reason that is too long', { when_to_use: 'x'.repeat(501) }],
    ['an order that is not whole', { sort_order: 1.5 }],
    ['an order below zero', { sort_order: -1 }],
    ['an order that is too big', { sort_order: 10001 }],
    ['an order in words', { sort_order: 'first' }],
  ])('refuses %s', async (_label, change) => {
    const res = await as('post', '/api/admin/emergency-contacts').send({ ...NEW_CONTACT, ...change });
    expect(res.status).toBe(400);
    const [{ n }] = await q('SELECT count(*)::int AS n FROM emergency_contacts');
    expect(n).toBe(0);
  });
});

describe('GET /api/admin/emergency-contacts', () => {
  it('lists the contacts in order with their ids', async () => {
    await as('post', '/api/admin/emergency-contacts').send({ ...NEW_CONTACT, name: 'Second', sort_order: 20 });
    await as('post', '/api/admin/emergency-contacts').send({ ...NEW_CONTACT, name: 'First', sort_order: 10 });
    const res = await as('get', '/api/admin/emergency-contacts');
    expect(res.body.map((c) => c.name)).toEqual(['First', 'Second']);
    expect(Object.keys(res.body[0]).sort()).toEqual(['contact', 'id', 'name', 'sort_order', 'updated_at', 'when_to_use']);
  });

  it('is empty when the table is empty even though the public list is not', async () => {
    expect((await as('get', '/api/admin/emergency-contacts')).body).toEqual([]);
    expect(await publicList()).toEqual(BUILT_IN_CONTACTS);
  });
});

describe('PUT /api/admin/emergency-contacts/:id', () => {
  it('corrects a number and keeps the rest', async () => {
    const { body } = await as('post', '/api/admin/emergency-contacts').send(NEW_CONTACT);
    const res = await as('put', `/api/admin/emergency-contacts/${body.id}`).send({ contact: '0788111222' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Campus Counselling', contact: '0788111222', sort_order: 100 });
    expect((await publicList())[0].contact).toBe('0788111222');
  });

  it('checks the contact as it would become', async () => {
    const { body } = await as('post', '/api/admin/emergency-contacts').send(NEW_CONTACT);
    expect((await as('put', `/api/admin/emergency-contacts/${body.id}`).send({ contact: '' })).status).toBe(400);
    expect((await as('put', `/api/admin/emergency-contacts/${body.id}`).send({ sort_order: 'x' })).status).toBe(400);
    const [row] = await q('SELECT contact FROM emergency_contacts WHERE id = $1', [body.id]);
    expect(row.contact).toBe('0788000000');
  });

  it('answers 404 for an unknown contact and a bad id', async () => {
    expect((await as('put', '/api/admin/emergency-contacts/99999').send({ name: 'X' })).status).toBe(404);
    expect((await as('put', '/api/admin/emergency-contacts/abc').send({ name: 'X' })).status).toBe(404);
  });
});

describe('DELETE /api/admin/emergency-contacts/:id', () => {
  it('removes a contact', async () => {
    const { body } = await as('post', '/api/admin/emergency-contacts').send(NEW_CONTACT);
    expect((await as('delete', `/api/admin/emergency-contacts/${body.id}`)).status).toBe(204);
    expect((await as('get', '/api/admin/emergency-contacts')).body).toEqual([]);
  });

  it('can remove the last one because the public page falls back to the built-in list', async () => {
    const { body } = await as('post', '/api/admin/emergency-contacts').send(NEW_CONTACT);
    expect(await publicList()).toHaveLength(1);
    await as('delete', `/api/admin/emergency-contacts/${body.id}`);
    expect(await publicList()).toEqual(BUILT_IN_CONTACTS);
  });

  it('answers 404 when there is nothing to remove', async () => {
    expect((await as('delete', '/api/admin/emergency-contacts/99999')).status).toBe(404);
  });
});

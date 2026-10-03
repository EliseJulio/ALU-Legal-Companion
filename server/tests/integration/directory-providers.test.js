// The directory of legal bodies. A person is only sent to a body that a legal expert checked,
// and an edit to a checked fact takes the entry off the public list until it is checked again.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

let admin;
let expert;
let student;

beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin', 'admin.dir@alustudent.com');
  expert = await makeUser('legal_expert', 'expert.dir@example.org');
  student = await makeUser('student', 'student.dir@alustudent.com');
});

const submit = (id) => request(app).post(`/api/directory/providers/${id}/submit`).set('Authorization', admin.auth);
const verify = (id, who = expert) => request(app).post(`/api/directory/providers/${id}/verify`).set('Authorization', who.auth);
const giveBack = (id, body, who = expert) =>
  request(app).post(`/api/directory/providers/${id}/return`).set('Authorization', who.auth).send(body);
const edit = (id, body) => request(app).put(`/api/admin/providers/${id}`).set('Authorization', admin.auth).send(body);
const add = (body, who = admin) => request(app).post('/api/admin/providers').set('Authorization', who.auth).send(body);

describe('the public directory', () => {
  test('hides a draft entry and shows it once an expert verifies it', async () => {
    const abunzi = await makeProvider({ name: 'Abunzi committee of the cell', type: 'abunzi' });
    expect((await request(app).get('/api/providers')).body).toHaveLength(0);

    await submit(abunzi.id);
    await verify(abunzi.id);
    const res = await request(app).get('/api/providers');
    expect(res.body).toHaveLength(1);

    const [row] = res.body;
    expect(row.verified_by_name).toBe('Test legal_expert');
    expect(row.languages).toBe('Kinyarwanda, English');
    expect(row.is_free).toBe(true);
    expect(row.stale).toBe(false);
    expect(row).not.toHaveProperty('status');
  });

  test('verifying dates the entry, as a plain date', async () => {
    const p = await makeProvider();
    await submit(p.id);
    await verify(p.id);
    const [row] = (await request(app).get('/api/providers')).body;
    // A date with no time, so the day cannot shift with the time zone.
    expect(row.last_checked_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('marks an entry as out of date when it was last checked over 180 days ago', async () => {
    const p = await makeProvider({}, { verifiedBy: expert.user.id });
    await q('UPDATE providers SET last_checked_at = CURRENT_DATE - 181 WHERE id = $1', [p.id]);
    const [row] = (await request(app).get('/api/providers')).body;
    expect(row.stale).toBe(true);
  });

  test('filters by type and by free', async () => {
    await makeProvider({ name: 'Isange', type: 'isange', is_free: true }, { verifiedBy: expert.user.id });
    await makeProvider({ name: 'Adv. Paid', type: 'pro_bono_lawyer', is_free: false }, { verifiedBy: expert.user.id });
    expect((await request(app).get('/api/providers?type=isange')).body.map((p) => p.name)).toEqual(['Isange']);
    expect((await request(app).get('/api/providers?free=true')).body.map((p) => p.name)).toEqual(['Isange']);
  });

  test('searches the name, place and services', async () => {
    await makeProvider({ name: 'Isange One Stop Centre', location: 'Kigali', services: 'Medical and legal help' }, { verifiedBy: expert.user.id });
    await makeProvider({ name: 'Huye Abunzi', location: 'Huye', services: 'Mediation' }, { verifiedBy: expert.user.id });
    expect((await request(app).get('/api/providers?q=huye')).body.map((p) => p.name)).toEqual(['Huye Abunzi']);
    expect((await request(app).get('/api/providers?q=medical')).body.map((p) => p.name)).toEqual(['Isange One Stop Centre']);
  });

  test('the database refuses a published entry with no verifier', async () => {
    await expect(q("INSERT INTO providers (name, type, status) VALUES ('X', 'other', 'published')"))
      .rejects.toThrow(/providers_published_is_verified/);
  });
});

describe('adding and editing entries', () => {
  test('a new entry is always a draft, even if the request says published', async () => {
    const res = await add({ name: 'New', type: 'abunzi', status: 'published' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
  });

  test('only an admin can add or edit', async () => {
    expect((await add({ name: 'New', type: 'abunzi' }, expert)).status).toBe(403);
    expect((await add({ name: 'New', type: 'abunzi' }, student)).status).toBe(403);
    const p = await makeProvider();
    const res = await request(app).put(`/api/admin/providers/${p.id}`).set('Authorization', expert.auth).send({});
    expect(res.status).toBe(403);
  });

  test('needs a name and a type, and the type must be a real one', async () => {
    expect((await add({ name: 'No type' })).status).toBe(400);
    const res = await add({ name: 'New', type: 'witch_doctor' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type must be one of/);
  });

  test('the source link must be a full https address', async () => {
    for (const bad of ['http://example.org', 'javascript:alert(1)', 'not a url']) {
      expect((await add({ name: 'New', type: 'abunzi', official_source_url: bad })).status).toBe(400);
    }
    expect((await add({ name: 'New', type: 'abunzi', official_source_url: 'https://www.example.org/' })).status).toBe(201);
  });

  test('editing a checked fact sends the entry back to draft and clears the verifier', async () => {
    const p = await makeProvider({}, { verifiedBy: expert.user.id });
    const res = await edit(p.id, { contact: '0788111111' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.verified_by).toBeNull();
    expect((await request(app).get('/api/providers')).body).toHaveLength(0);
  });

  test('sending the same values again is not an edit', async () => {
    const p = await makeProvider({}, { verifiedBy: expert.user.id });
    const res = await edit(p.id, { name: p.name, contact: p.contact, is_free: p.is_free });
    expect(res.body.status).toBe('published');
  });

  test('a field that is not sent keeps its value, and a field sent as null is cleared', async () => {
    const p = await makeProvider({ languages: 'Kinyarwanda', location: 'Kigali' });
    const kept = await edit(p.id, { location: 'Huye' });
    expect(kept.body.languages).toBe('Kinyarwanda');
    expect(kept.body.location).toBe('Huye');

    const cleared = await edit(p.id, { languages: null });
    expect(cleared.body.languages).toBeNull();
    expect(cleared.body.location).toBe('Huye');
  });

  test('a refused edit changes nothing', async () => {
    const p = await makeProvider({}, { verifiedBy: expert.user.id });
    const res = await edit(p.id, { type: 'witch_doctor', contact: 'changed' });
    expect(res.status).toBe(400);
    const [row] = await q('SELECT contact, status FROM providers WHERE id = $1', [p.id]);
    expect(row.contact).toBe(p.contact);
    expect(row.status).toBe('published');
  });

  test('an unknown entry is a 404', async () => {
    expect((await edit(9999, { name: 'x' })).status).toBe(404);
  });
});

describe('the review steps', () => {
  test('only a legal expert verifies, and only an entry that is waiting for review', async () => {
    const p = await makeProvider();
    expect((await verify(p.id)).status).toBe(400); // still a draft
    await submit(p.id);
    expect((await verify(p.id, admin)).status).toBe(403);
    expect((await verify(p.id, student)).status).toBe(403);
    expect((await verify(p.id)).status).toBe(200);
  });

  test('only a draft can be submitted', async () => {
    const p = await makeProvider();
    expect((await submit(p.id)).status).toBe(200);
    expect((await submit(p.id)).status).toBe(400);
  });

  test('a return needs a reason, sends the entry back to draft and shows the reason to staff', async () => {
    const p = await makeProvider();
    await submit(p.id);
    expect((await giveBack(p.id, {})).status).toBe(400);

    const res = await giveBack(p.id, { comment: 'The phone number on their site is different.' });
    expect(res.body.status).toBe('draft');

    const all = await request(app).get('/api/directory/providers/all').set('Authorization', admin.auth);
    expect(all.body[0].review_comment).toBe('The phone number on their site is different.');
  });

  test('the comment goes once the entry is verified', async () => {
    const p = await makeProvider();
    await submit(p.id);
    await giveBack(p.id, { comment: 'Fix the number.' });
    await submit(p.id);
    await verify(p.id);
    const all = await request(app).get('/api/directory/providers/all').set('Authorization', admin.auth);
    expect(all.body[0].review_comment).toBeNull();
  });

  test('every decision is kept as history', async () => {
    const p = await makeProvider();
    await submit(p.id);
    await giveBack(p.id, { comment: 'First reason.' });
    await submit(p.id);
    await verify(p.id);
    const history = await q(
      "SELECT decision, comment FROM directory_reviews WHERE record_type = 'provider' AND record_id = $1 ORDER BY id", [p.id]);
    expect(history).toEqual([
      { decision: 'returned', comment: 'First reason.' },
      { decision: 'verified', comment: null },
    ]);
  });

  test('the staff list shows every entry, and only staff can read it', async () => {
    await makeProvider({ name: 'A draft entry' });
    const asAdmin = await request(app).get('/api/directory/providers/all').set('Authorization', admin.auth);
    expect(asAdmin.body.map((p) => p.name)).toEqual(['A draft entry']);
    expect((await request(app).get('/api/directory/providers/all').set('Authorization', expert.auth)).status).toBe(200);
    expect((await request(app).get('/api/directory/providers/all').set('Authorization', student.auth)).status).toBe(403);
    expect((await request(app).get('/api/directory/providers/all')).status).toBe(401);
  });
});

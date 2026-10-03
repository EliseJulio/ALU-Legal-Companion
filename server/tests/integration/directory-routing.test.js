// Routing: where a kind of matter must go first.
// A person is sent only to a body a legal expert checked by a route a legal expert checked.
// An edit to either takes it off the public pages until it is checked again. No language
// model is involved.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeProvider, routeBody } from '../helpers.js';

let admin;
let expert;
let student;

beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin', 'admin.route@alustudent.com');
  expert = await makeUser('legal_expert', 'expert.route@example.org');
  student = await makeUser('student', 'student.route@alustudent.com');
});

const submit = (id) => request(app).post(`/api/directory/routes/${id}/submit`).set('Authorization', admin.auth);
const verify = (id, who = expert) => request(app).post(`/api/directory/routes/${id}/verify`).set('Authorization', who.auth);
const giveBack = (id, body) => request(app).post(`/api/directory/routes/${id}/return`).set('Authorization', expert.auth).send(body);
const edit = (id, body) => request(app).put(`/api/directory/routes/${id}`).set('Authorization', admin.auth).send(body);

async function publishRoute(id) {
  expect((await submit(id)).status).toBe(200);
  expect((await verify(id)).status).toBe(200);
}

async function createRoute(forumId, overrides) {
  const res = await request(app).post('/api/directory/routes').set('Authorization', admin.auth)
    .send(routeBody(forumId, overrides));
  expect(res.status).toBe(201);
  return res.body;
}

describe('where a matter goes first', () => {
  test('sends the reader to the checked body, with the law, the steps and the deadline', async () => {
    const abunzi = await makeProvider({ name: 'Abunzi committee of the cell', type: 'abunzi' }, { verifiedBy: expert.user.id });
    const route = await createRoute(abunzi.id);
    expect(route.status).toBe('draft');
    await publishRoute(route.id);

    const res = await request(app).get(`/api/directory/routes/${route.id}`);
    expect(res.status).toBe(200);
    expect(res.body.first_forum.name).toBe('Abunzi committee of the cell');
    expect(res.body.legal_basis).toBe('Law No. 37/2016, Art. 10');
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.deadline_days).toBe(30);
    expect(res.body.deadline_runs_from).toBe('the sector committee decision');
    expect(res.body.exclusions).toMatch(/company/);
    expect(res.body.verified_by_name).toBe('Test legal_expert');
  });

  test('a draft route is not public', async () => {
    const forum = await makeProvider({}, { verifiedBy: expert.user.id });
    const route = await createRoute(forum.id);
    expect((await request(app).get('/api/directory/routes')).body).toHaveLength(0);
    expect((await request(app).get(`/api/directory/routes/${route.id}`)).status).toBe(404);
  });

  test('a checked route is never shown if its office is not checked', async () => {
    const draftForum = await makeProvider({ name: 'Unchecked office' });
    const route = await createRoute(draftForum.id);
    await publishRoute(route.id);
    expect((await request(app).get('/api/directory/routes')).body).toHaveLength(0);
    expect((await request(app).get(`/api/directory/routes/${route.id}`)).status).toBe(404);
  });

  test('drops out when its office is edited, and comes back when the office is checked again', async () => {
    const forum = await makeProvider({ type: 'abunzi' }, { verifiedBy: expert.user.id });
    const route = await createRoute(forum.id);
    await publishRoute(route.id);
    expect((await request(app).get('/api/directory/routes')).body).toHaveLength(1);

    await request(app).put(`/api/admin/providers/${forum.id}`).set('Authorization', admin.auth).send({ contact: 'new' });
    expect((await request(app).get('/api/directory/routes')).body).toHaveLength(0);

    await request(app).post(`/api/directory/providers/${forum.id}/submit`).set('Authorization', admin.auth);
    await request(app).post(`/api/directory/providers/${forum.id}/verify`).set('Authorization', expert.auth);
    expect((await request(app).get('/api/directory/routes')).body).toHaveLength(1);
  });

  test('any edit to a route sends it back to draft', async () => {
    const forum = await makeProvider({}, { verifiedBy: expert.user.id });
    const route = await createRoute(forum.id);
    await publishRoute(route.id);

    const res = await edit(route.id, { deadline_days: 15 });
    expect(res.body.status).toBe('draft');
    expect(res.body.verified_by).toBeNull();
    expect((await request(app).get(`/api/directory/routes/${route.id}`)).status).toBe(404);
  });

  test('a bad id is a 404', async () => {
    expect((await request(app).get('/api/directory/routes/abc')).status).toBe(404);
  });
});

describe('finding a matter from the words a person uses', () => {
  test('puts the matching matter first, with the body to go to', async () => {
    const abunzi = await makeProvider({ name: 'Abunzi', type: 'abunzi' }, { verifiedBy: expert.user.id });
    const labour = await makeProvider({ name: 'District labour inspector', type: 'labour_inspector' }, { verifiedBy: expert.user.id });
    const deposit = await createRoute(abunzi.id);
    const wages = await createRoute(labour.id, {
      matter_type: 'unpaid_wages',
      title: 'My employer has not paid my wages',
      keywords: 'salary pay job work dismissed fired contract employer',
      legal_basis: 'Law No. 66/2018, Art. 102',
      deadline_days: null,
      deadline_runs_from: null,
    });
    await publishRoute(deposit.id);
    await publishRoute(wages.id);

    const a = await request(app).get('/api/directory/routes').query({ q: 'the landlord kept my deposit when I moved out' });
    expect(a.body[0].matter_type).toBe('unreturned_deposit');

    const b = await request(app).get('/api/directory/routes').query({ q: 'I was fired and they owe me salary' });
    expect(b.body[0].matter_type).toBe('unpaid_wages');
    expect(b.body[0].first_forum_name).toBe('District labour inspector');
  });

  test('with no words it lists every published matter', async () => {
    const forum = await makeProvider({}, { verifiedBy: expert.user.id });
    const route = await createRoute(forum.id);
    await publishRoute(route.id);
    const res = await request(app).get('/api/directory/routes');
    expect(res.body.map((r) => r.matter_type)).toEqual(['unreturned_deposit']);
  });

  test('finds nothing for words that match no matter', async () => {
    const forum = await makeProvider({}, { verifiedBy: expert.user.id });
    const route = await createRoute(forum.id);
    await publishRoute(route.id);
    const res = await request(app).get('/api/directory/routes').query({ q: 'volcano' });
    expect(res.body).toEqual([]);
  });
});

describe('adding and editing routes', () => {
  test('a route is checked before it is saved', async () => {
    const forum = await makeProvider();
    const post = (o) => request(app).post('/api/directory/routes').set('Authorization', admin.auth).send(routeBody(forum.id, o));
    expect((await post({ steps: [] })).status).toBe(400);
    expect((await post({ legal_basis: '' })).status).toBe(400);
    expect((await post({ deadline_runs_from: null })).body.error).toMatch(/both a number of days/);
    expect((await post({ deadline_days: -5 })).status).toBe(400);
    expect((await post({ first_forum_id: 999 })).status).toBe(400);
    expect((await post({ matter_type: 'Bad Type!' })).status).toBe(400);
    expect((await post()).status).toBe(201);
    expect((await post()).status).toBe(409); // the same matter_type again
  });

  test('a route with no deadline is fine', async () => {
    const forum = await makeProvider();
    const route = await createRoute(forum.id, { deadline_days: null, deadline_runs_from: null });
    expect(route.deadline_days).toBeNull();
  });

  test('only an admin can add or edit routes', async () => {
    const forum = await makeProvider();
    const asExpert = await request(app).post('/api/directory/routes').set('Authorization', expert.auth).send(routeBody(forum.id));
    expect(asExpert.status).toBe(403);
    const route = await createRoute(forum.id);
    const edited = await request(app).put(`/api/directory/routes/${route.id}`).set('Authorization', expert.auth).send({});
    expect(edited.status).toBe(403);
  });

  test('fields that are not sent keep their value when editing', async () => {
    const forum = await makeProvider();
    const route = await createRoute(forum.id);
    const res = await edit(route.id, { title: 'A new title' });
    expect(res.body.title).toBe('A new title');
    expect(res.body.legal_basis).toBe('Law No. 37/2016, Art. 10');
    expect(res.body.steps).toHaveLength(2);
  });

  test('an edit is checked before it is saved, so a refused edit changes nothing', async () => {
    const forum = await makeProvider({}, { verifiedBy: expert.user.id });
    const route = await createRoute(forum.id);
    await publishRoute(route.id);

    const res = await edit(route.id, { steps: [] });
    expect(res.status).toBe(400);
    const [row] = await q('SELECT status FROM matter_routes WHERE id = $1', [route.id]);
    expect(row.status).toBe('published');
  });

  test('an edit cannot reuse the matter_type of another route', async () => {
    const forum = await makeProvider();
    await createRoute(forum.id);
    const second = await createRoute(forum.id, { matter_type: 'second_matter' });
    expect((await edit(second.id, { matter_type: 'unreturned_deposit' })).status).toBe(409);
  });

  test('an unknown route is a 404', async () => {
    expect((await edit(9999, { title: 'x' })).status).toBe(404);
  });
});

describe('the review steps for routes', () => {
  test('only a legal expert verifies, and only a route that is waiting for review', async () => {
    const forum = await makeProvider({}, { verifiedBy: expert.user.id });
    const route = await createRoute(forum.id);
    expect((await verify(route.id)).status).toBe(400); // still a draft
    await submit(route.id);
    expect((await verify(route.id, admin)).status).toBe(403);
    expect((await verify(route.id, student)).status).toBe(403);
    expect((await verify(route.id)).status).toBe(200);
  });

  test('a return needs a reason, and the reason shows to staff', async () => {
    const forum = await makeProvider();
    const route = await createRoute(forum.id);
    await submit(route.id);
    expect((await giveBack(route.id, {})).status).toBe(400);

    const res = await giveBack(route.id, { comment: 'The article number is wrong.' });
    expect(res.body.status).toBe('draft');

    const all = await request(app).get('/api/directory/routes/all').set('Authorization', admin.auth);
    expect(all.body[0].review_comment).toBe('The article number is wrong.');
  });

  test('decisions about routes are kept as history', async () => {
    const forum = await makeProvider();
    const route = await createRoute(forum.id);
    await submit(route.id);
    await verify(route.id);
    const history = await q(
      "SELECT decision FROM directory_reviews WHERE record_type = 'route' AND record_id = $1", [route.id]);
    expect(history).toEqual([{ decision: 'verified' }]);
  });

  test('the staff list shows every route with its office and the office status', async () => {
    const draftForum = await makeProvider({ name: 'Unchecked office' });
    await createRoute(draftForum.id);
    const res = await request(app).get('/api/directory/routes/all').set('Authorization', expert.auth);
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ first_forum_name: 'Unchecked office', first_forum_status: 'draft', status: 'draft' });
  });

  test('visitors and students cannot read the staff list', async () => {
    expect((await request(app).get('/api/directory/routes/all')).status).toBe(401);
    expect((await request(app).get('/api/directory/routes/all').set('Authorization', student.auth)).status).toBe(403);
  });
});

describe('the database', () => {
  test('refuses a published route with no verifier', async () => {
    const forum = await makeProvider();
    await expect(q(
      `INSERT INTO matter_routes (matter_type, title, first_forum_id, legal_basis, status)
       VALUES ('x_matter', 'X', $1, 'Law', 'published')`, [forum.id],
    )).rejects.toThrow(/matter_routes_published_is_verified/);
  });

  test('refuses a deadline with nothing to count from', async () => {
    const forum = await makeProvider();
    await expect(q(
      `INSERT INTO matter_routes (matter_type, title, first_forum_id, legal_basis, deadline_days)
       VALUES ('x_matter', 'X', $1, 'Law', 30)`, [forum.id],
    )).rejects.toThrow(/matter_routes_check/);
  });
});

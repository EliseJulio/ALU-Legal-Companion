import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { DOMAINS } from '../../src/services/domains.js';
import { resetDb, makeUser, makeProvider, makeRoute } from '../helpers.js';

let admin;
let expert;
let student;
let forum; // a published office for the routes to point at
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
  expert = await makeUser('legal_expert');
  student = await makeUser('student');
  forum = await makeProvider({ name: 'Abunzi Test Office', category: 'organisation', type: 'abunzi' },
    { verifiedBy: expert.user.id });
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const search = (query = '') => request(app).get(`/api/directory/routes${query}`);
const published = (overrides = {}) => makeRoute(forum.id, overrides, { verifiedBy: expert.user.id });

const NEW_ROUTE = {
  matter_type: 'unpaid_wages', title: 'My employer has not paid me', keywords: 'salary job pay',
  first_forum_id: null, legal_basis: 'Law No. 66/2018, Art. 102',
  steps: ['Raise it at work', 'Go to the labour inspector'], deadline_days: 730,
  deadline_runs_from: 'the day the dispute started',
};
const newRoute = (overrides = {}) => ({ ...NEW_ROUTE, first_forum_id: forum.id, ...overrides });

describe('GET /api/directory/routes (public search)', () => {
  it('lists published routes whose office is also published', async () => {
    await published({ matter_type: 'one_matter', title: 'First matter' });
    await makeRoute(forum.id, { matter_type: 'draft_matter', title: 'A draft' });
    const res = await search();
    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.title)).toEqual(['First matter']);
  });

  it('leaves out a route whose office has not been checked', async () => {
    const draftOffice = await makeProvider({ name: 'Unchecked Office' });
    await makeRoute(draftOffice.id, { matter_type: 'points_nowhere', title: 'Points nowhere' }, { verifiedBy: expert.user.id });
    expect((await search()).body).toEqual([]);

    await q("UPDATE providers SET status = 'published', verified_by = $1, verified_at = now() WHERE id = $2",
      [expert.user.id, draftOffice.id]);
    expect((await search()).body.map((r) => r.title)).toEqual(['Points nowhere']);
  });

  it('returns the shape the page needs and nothing about the steps', async () => {
    await published();
    const [row] = (await search()).body;
    expect(Object.keys(row).sort()).toEqual([
      'area', 'deadline_days', 'deadline_runs_from', 'first_forum_id', 'first_forum_name', 'first_forum_type',
      'id', 'matter_type', 'score', 'title', 'verified_at']);
    expect(row.first_forum_name).toBe('Abunzi Test Office');
    expect(row.first_forum_type).toBe('abunzi');
  });

  it('says who checked each route and when, and gives nothing else about that person', async () => {
    await published();
    const [row] = (await search()).body;
    expect(row).not.toHaveProperty('verified_by_name');
    expect(new Date(row.verified_at).getTime()).not.toBeNaN();
    const text = JSON.stringify(row);
    expect(text).not.toContain(expert.user.email);
    expect(text).not.toMatch(/verified_by"|"email"|"user_id"|password/);
  });

  it('finds a route from a sentence in the reader’s own words', async () => {
    await published({ matter_type: 'deposit', title: 'My landlord will not return my deposit', keywords: 'rent house' });
    await published({ matter_type: 'wages', title: 'My employer has not paid me', keywords: 'salary job' });
    const res = await search('?q=my%20landlord%20kept%20the%20deposit');
    expect(res.body.map((r) => r.matter_type)).toEqual(['deposit']);
  });

  it('puts the route that matches more of the words first', async () => {
    await published({ matter_type: 'both', title: 'Landlord kept my deposit', keywords: 'rent' });
    await published({ matter_type: 'one', title: 'Rent arrears', keywords: 'landlord' });
    const res = await search('?q=landlord%20deposit');
    expect(res.body.map((r) => r.matter_type)).toEqual(['both', 'one']);
  });

  it('finds nothing for words that match no route', async () => {
    await published();
    expect((await search('?q=astronomy')).body).toEqual([]);
  });

  it('finds nothing when the text is only small words', async () => {
    await published();
    expect((await search('?q=the%20and%20of%20my')).body).toEqual([]);
  });

  it('lists every route in title order when there is no text', async () => {
    await published({ matter_type: 'b_matter', title: 'Beta matter' });
    await published({ matter_type: 'a_matter', title: 'Alpha matter' });
    expect((await search()).body.map((r) => r.title)).toEqual(['Alpha matter', 'Beta matter']);
    expect((await search('?q=%20%20')).body).toHaveLength(2);
  });

  it('treats text that looks like SQL as plain words', async () => {
    await published();
    const res = await search(`?q=${encodeURIComponent("x'; DROP TABLE matter_routes; --")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect((await search()).body).toHaveLength(1);
  });

  it('copes with a very long text', async () => {
    await published();
    const res = await search(`?q=${'deposit '.repeat(500)}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/directory/routes/:id (public)', () => {
  it('returns the whole answer with the office', async () => {
    const route = await published({ exclusions: 'Not for companies.' });
    const res = await request(app).get(`/api/directory/routes/${route.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: route.id, matter_type: 'unreturned_deposit', legal_basis: 'Law No. 37/2016, Art. 10',
      exclusions: 'Not for companies.', deadline_days: 30,
    });
    expect(res.body).not.toHaveProperty('verified_by_name');
    expect(res.body.steps).toEqual(['Go to the Abunzi committee of your cell', 'Appeal to the sector committee']);
    expect(res.body.first_forum).toMatchObject({ id: forum.id, name: 'Abunzi Test Office', category: 'organisation' });
    expect(res.body).not.toHaveProperty('first_forum_id');
    expect(res.body.first_forum).not.toHaveProperty('user_id');
  });

  it('answers 404 for a draft route and a missing route and a bad id', async () => {
    const draft = await makeRoute(forum.id);
    expect((await request(app).get(`/api/directory/routes/${draft.id}`)).status).toBe(404);
    expect((await request(app).get('/api/directory/routes/99999')).status).toBe(404);
    expect((await request(app).get('/api/directory/routes/abc')).status).toBe(404);
  });

  it('answers 404 for a published route whose office is not published', async () => {
    const draftOffice = await makeProvider({ name: 'Unchecked Office' });
    const route = await makeRoute(draftOffice.id, {}, { verifiedBy: expert.user.id });
    expect((await request(app).get(`/api/directory/routes/${route.id}`)).status).toBe(404);
  });
});

describe('GET /api/directory/routes/all (staff)', () => {
  it('needs an admin login and is not mistaken for an id', async () => {
    expect((await request(app).get('/api/directory/routes/all')).status).toBe(401);
    expect((await as(student, 'get', '/api/directory/routes/all')).status).toBe(403);
    expect((await as(expert, 'get', '/api/directory/routes/all')).status).toBe(403);
  });

  it('shows every state with the state of the office', async () => {
    const draftOffice = await makeProvider({ name: 'Unchecked Office' });
    await makeRoute(forum.id, { matter_type: 'draft_route' });
    await makeRoute(draftOffice.id, { matter_type: 'ready_route' }, { verifiedBy: admin.user.id });
    const res = await as(admin, 'get', '/api/directory/routes/all');
    expect(res.status).toBe(200);
    const ready = res.body.find((r) => r.matter_type === 'ready_route');
    expect(ready).toMatchObject({ status: 'published', first_forum_name: 'Unchecked Office', first_forum_status: 'draft' });
    expect(res.body).toHaveLength(2);
  });
});

describe('POST /api/directory/routes', () => {
  it('is for the admin only', async () => {
    expect((await request(app).post('/api/directory/routes').send(newRoute())).status).toBe(401);
    expect((await as(student, 'post', '/api/directory/routes').send(newRoute())).status).toBe(403);
    expect((await as(expert, 'post', '/api/directory/routes').send(newRoute())).status).toBe(403);
  });

  it('creates a draft whatever the body says and does not return the search column', async () => {
    const res = await as(admin, 'post', '/api/directory/routes').send(newRoute({ status: 'published' }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ matter_type: 'unpaid_wages', status: 'draft', verified_by: null, deadline_days: 730 });
    expect(res.body).not.toHaveProperty('tsv');
    expect((await search()).body).toEqual([]);
  });

  it('trims the steps and drops blank ones', async () => {
    const res = await as(admin, 'post', '/api/directory/routes').send(newRoute({ steps: ['  First  ', '', '   ', 'Second'] }));
    expect(res.body.steps).toEqual(['First', 'Second']);
  });

  it('accepts a route with no deadline', async () => {
    const res = await as(admin, 'post', '/api/directory/routes')
      .send(newRoute({ deadline_days: null, deadline_runs_from: null }));
    expect(res.status).toBe(201);
    expect(res.body.deadline_days).toBeNull();
  });

  it.each([
    ['a matter_type that is too short', { matter_type: 'ab' }, /matter_type/],
    ['a matter_type with capital letters', { matter_type: 'Unpaid_Wages' }, /matter_type/],
    ['no title', { title: '  ' }, /title is required/],
    ['no legal basis', { legal_basis: '' }, /legal_basis is required/],
    ['no office', { first_forum_id: null }, /first_forum_id/],
    ['an office id that is not a number', { first_forum_id: 'abc' }, /first_forum_id/],
    ['no steps', { steps: [] }, /at least one step/],
    ['steps that are not a list', { steps: 'Go there' }, /at least one step/],
    ['days with nothing to count from', { deadline_runs_from: null }, /both a number of days/],
    ['something to count from but no days', { deadline_days: null }, /both a number of days/],
    ['zero days', { deadline_days: 0 }, /greater than zero/],
    ['days that are not whole', { deadline_days: 1.5 }, /whole number/],
  ])('refuses %s', async (_label, change, message) => {
    const res = await as(admin, 'post', '/api/directory/routes').send(newRoute(change));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });

  it('refuses an office that does not exist', async () => {
    const res = await as(admin, 'post', '/api/directory/routes').send(newRoute({ first_forum_id: 99999 }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/first_forum_id/);
  });

  it('refuses a second route for the same matter_type', async () => {
    await as(admin, 'post', '/api/directory/routes').send(newRoute());
    const again = await as(admin, 'post', '/api/directory/routes').send(newRoute());
    expect(again.status).toBe(409);
  });
});

describe('PUT /api/directory/routes/:id', () => {
  const put = (who, id, body) => as(who, 'put', `/api/directory/routes/${id}`).send(body);

  it('is for the admin only and answers 404 for an unknown route', async () => {
    const route = await makeRoute(forum.id);
    expect((await put(expert, route.id, { title: 'X' })).status).toBe(403);
    expect((await put(admin, 99999, { title: 'X' })).status).toBe(404);
    expect((await put(admin, 'abc', { title: 'X' })).status).toBe(404);
  });

  it('keeps what the request did not send', async () => {
    const route = await makeRoute(forum.id);
    const res = await put(admin, route.id, { title: 'A new title' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'A new title', legal_basis: 'Law No. 37/2016, Art. 10', deadline_days: 30 });
    expect(res.body).not.toHaveProperty('tsv');
  });

  it('sends a published route back to draft on any edit', async () => {
    const route = await published();
    const res = await put(admin, route.id, { deadline_note: 'A small note.' });
    expect(res.body).toMatchObject({ status: 'draft', verified_by: null, verified_at: null });
    expect((await search()).body).toEqual([]);
  });

  it('clears a deadline only when both parts are cleared', async () => {
    const route = await makeRoute(forum.id);
    expect((await put(admin, route.id, { deadline_days: null })).status).toBe(400);
    const res = await put(admin, route.id, { deadline_days: null, deadline_runs_from: null });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deadline_days: null, deadline_runs_from: null });
  });

  it('checks the route as it would become', async () => {
    const route = await makeRoute(forum.id);
    const res = await put(admin, route.id, { steps: [] });
    expect(res.status).toBe(400);
    const [row] = await q('SELECT steps FROM matter_routes WHERE id = $1', [route.id]);
    expect(row.steps).toHaveLength(2);
  });

  it('refuses an office that does not exist', async () => {
    const route = await makeRoute(forum.id);
    expect((await put(admin, route.id, { first_forum_id: 99999 })).status).toBe(400);
  });

  it('refuses a matter_type that another route uses', async () => {
    await makeRoute(forum.id, { matter_type: 'taken_type' });
    const route = await makeRoute(forum.id, { matter_type: 'other_type' });
    expect((await put(admin, route.id, { matter_type: 'taken_type' })).status).toBe(409);
    expect((await put(admin, route.id, { matter_type: 'other_type' })).status).toBe(200);
  });
});

describe('publishing a route', () => {
  const publish = (who, id) => as(who, 'post', `/api/directory/routes/${id}/publish`).send({});

  it('goes from a new route to the public list and back out on an edit', async () => {
    const created = await as(admin, 'post', '/api/directory/routes').send(newRoute());
    const id = created.body.id;
    expect((await publish(expert, id)).status).toBe(403);
    expect((await publish(admin, id)).status).toBe(200);
    expect((await search()).body.map((r) => r.matter_type)).toEqual(['unpaid_wages']);

    await as(admin, 'put', `/api/directory/routes/${id}`).send({ title: 'My employer has not paid my salary' });
    expect((await search()).body).toEqual([]);
  });

  it('stamps the admin and records a published review of type route', async () => {
    const route = await makeRoute(forum.id);
    await publish(admin, route.id);
    const [row] = await q('SELECT status, verified_by FROM matter_routes WHERE id = $1', [route.id]);
    expect(row).toEqual({ status: 'published', verified_by: admin.user.id });
    const reviews = await q('SELECT record_type, record_id, decision FROM directory_reviews');
    expect(reviews).toEqual([{ record_type: 'route', record_id: route.id, decision: 'published' }]);
  });

  it('refuses to publish a route that is already published', async () => {
    const route = await published();
    expect((await publish(admin, route.id)).status).toBe(400);
  });

  it('keeps the review history of a route and a provider apart', async () => {
    const route = await makeRoute(forum.id);
    const entry = await makeProvider({ name: 'Another Office' });
    await publish(admin, route.id);
    await as(admin, 'post', `/api/directory/providers/${entry.id}/publish`);

    const routeReviews = await q("SELECT record_id FROM directory_reviews WHERE record_type = 'route'");
    const providerReviews = await q("SELECT record_id FROM directory_reviews WHERE record_type = 'provider'");
    expect(routeReviews).toEqual([{ record_id: route.id }]);
    expect(providerReviews).toEqual([{ record_id: entry.id }]);
  });
});

describe('the database rules', () => {
  it('refuses a published route with no verifier', async () => {
    const route = await makeRoute(forum.id);
    await expect(q("UPDATE matter_routes SET status = 'published' WHERE id = $1", [route.id]))
      .rejects.toThrow(/matter_routes_published_is_verified/);
  });

  it('refuses days with nothing to count from', async () => {
    await expect(makeRoute(forum.id, { deadline_days: 10, deadline_runs_from: null })).rejects.toThrow(/check constraint/);
  });

  it('refuses zero days', async () => {
    await expect(makeRoute(forum.id, { deadline_days: 0 })).rejects.toThrow(/check constraint/);
  });

  it('refuses a second route for the same matter_type', async () => {
    await makeRoute(forum.id);
    await expect(makeRoute(forum.id)).rejects.toThrow(/matter_type_key/);
  });
});

describe('the area of a route', () => {
  it('filters the public list by area and keeps the text search', async () => {
    await published({ matter_type: 'deposit', title: 'My landlord kept my deposit', area: 'tenancy' });
    await published({ matter_type: 'wages', title: 'My employer has not paid me', area: 'employment' });
    await published({ matter_type: 'unsorted', title: 'Something with no area' });
    expect((await search('?area=tenancy')).body.map((r) => r.matter_type)).toEqual(['deposit']);
    expect((await search('?area=employment')).body.map((r) => r.matter_type)).toEqual(['wages']);
    expect((await search('?area=tenancy&q=employer')).body).toEqual([]);
    expect((await search()).body).toHaveLength(3);
  });

  it('ignores an area it does not know', async () => {
    await published({ matter_type: 'deposit', title: 'My landlord kept my deposit', area: 'tenancy' });
    expect((await search('?area=astronomy')).body).toHaveLength(1);
  });

  it('lets an admin set the area when creating a route', async () => {
    const res = await as(admin, 'post', '/api/directory/routes').send(newRoute({ area: 'employment' }));
    expect(res.status).toBe(201);
    expect(res.body.area).toBe('employment');
  });

  it('treats an empty area as none', async () => {
    const res = await as(admin, 'post', '/api/directory/routes').send(newRoute({ area: '' }));
    expect(res.status).toBe(201);
    expect(res.body.area).toBeNull();
  });

  it('refuses an area that is not one of the six', async () => {
    const res = await as(admin, 'post', '/api/directory/routes').send(newRoute({ area: 'astronomy' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/area/);
  });

  it('sends a published route back to draft when its area is changed', async () => {
    const route = await published({ matter_type: 'deposit', area: 'tenancy' });
    const res = await as(admin, 'put', `/api/directory/routes/${route.id}`).send({ area: 'business' });
    expect(res.status).toBe(200);
    expect(res.body.area).toBe('business');
    expect(res.body.status).toBe('draft');
    expect(res.body.verified_by).toBeNull();
    expect((await search()).body).toEqual([]);
  });

  it('keeps the area when a later edit does not send it', async () => {
    const route = await published({ matter_type: 'deposit', area: 'tenancy' });
    const res = await as(admin, 'put', `/api/directory/routes/${route.id}`).send({ title: 'A clearer title' });
    expect(res.body.area).toBe('tenancy');
  });

  it('clears the area when it is sent empty', async () => {
    const route = await published({ matter_type: 'deposit', area: 'tenancy' });
    const res = await as(admin, 'put', `/api/directory/routes/${route.id}`).send({ area: '' });
    expect(res.body.area).toBeNull();
  });

  it('shows the area to staff in the full list', async () => {
    await published({ matter_type: 'deposit', area: 'tenancy' });
    const res = await as(admin, 'get', '/api/directory/routes/all');
    expect(res.body[0].area).toBe('tenancy');
  });

  it('does not mind capitals or spaces in an area, in the link or in the body', async () => {
    await published({ matter_type: 'deposit', title: 'My landlord kept my deposit', area: 'tenancy' });
    expect((await search('?area=%20Tenancy%20')).body).toHaveLength(1);
    const res = await as(admin, 'post', '/api/directory/routes').send(newRoute({ area: ' Employment ' }));
    expect(res.status).toBe(201);
    expect(res.body.area).toBe('employment');
  });

  it('refuses an area that is not text', async () => {
    for (const bad of [123, { a: 1 }, ['tenancy']]) {
      const res = await as(admin, 'post', '/api/directory/routes').send(newRoute({ area: bad }));
      expect(res.status).toBe(400);
    }
  });

  it('leaves a published route published when an edit is refused', async () => {
    const route = await published({ matter_type: 'deposit', area: 'tenancy' });
    const res = await as(admin, 'put', `/api/directory/routes/${route.id}`).send({ area: 'astronomy' });
    expect(res.status).toBe(400);
    const [row] = await q('SELECT status, area, verified_by FROM matter_routes WHERE id = $1', [route.id]);
    expect(row.status).toBe('published');
    expect(row.area).toBe('tenancy');
    expect(row.verified_by).not.toBeNull();
  });

  it('accepts every area of law in the database rule', async () => {
    for (const area of DOMAINS) {
      await expect(q("INSERT INTO matter_routes (matter_type, title, first_forum_id, legal_basis, area) VALUES ($1,'t',$2,'b',$3)", [`m_${area}`, forum.id, area]))
        .resolves.toBeDefined();
    }
  });

  it('refuses a database row with an unknown area', async () => {
    await expect(q("INSERT INTO matter_routes (matter_type, title, first_forum_id, legal_basis, area) VALUES ('x','x',$1,'x','astronomy')", [forum.id]))
      .rejects.toThrow();
  });
});

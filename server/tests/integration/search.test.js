import request from 'supertest';
import app from '../../src/app.js';
import { resetDb, makeUser, makeGuide, makeProvider, makeRoute } from '../helpers.js';

let expert;
let published;
beforeEach(async () => {
  await resetDb();
  expert = await makeUser('legal_expert');
  published = { verifiedBy: expert.user.id };
});

const search = (query = '') => request(app).get(`/api/search${query}`);

describe('GET /api/search', () => {
  it('needs words of at least two characters', async () => {
    expect((await search()).status).toBe(400);
    expect((await search('?q=')).status).toBe(400);
    expect((await search('?q=a')).status).toBe(400);
    expect((await search('?q=%20%20a%20')).status).toBe(400);
    expect((await search(`?q=${'x'.repeat(101)}`)).status).toBe(400);
  });

  it('refuses a library it does not know and says which ones exist', async () => {
    const res = await search('?q=deposit&library=lawyers');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/guides, routes, providers/);
  });

  it('finds a published guide by a word in its title and sends only what a result needs', async () => {
    await makeGuide({ title: 'Getting your deposit back', domain: 'tenancy' }, published);
    const res = await search('?q=deposit');
    expect(res.status).toBe(200);
    expect(res.body.results.guides).toHaveLength(1);
    const [guide] = res.body.results.guides;
    expect(Object.keys(guide).sort()).toEqual(['domain', 'id', 'source_law', 'summary', 'title']);
    expect(guide.title).toBe('Getting your deposit back');
  });

  it('never finds a guide that is not published', async () => {
    await makeGuide({ title: 'Deposit draft guide' });
    const res = await search('?q=deposit');
    expect(res.body.results.guides).toEqual([]);
  });

  it('finds a published directory entry and never one that is not published', async () => {
    await makeProvider({ name: 'Kigali Tenancy Clinic', services: 'Advice on rent' }, published);
    await makeProvider({ name: 'Hidden Tenancy Clinic' });
    const res = await search('?q=tenancy');
    expect(res.body.results.providers.map((p) => p.name)).toEqual(['Kigali Tenancy Clinic']);
    const [entry] = res.body.results.providers;
    expect(Object.keys(entry).sort()).toEqual(['id', 'location', 'name', 'services', 'type']);
  });

  it('finds a route only when the route and its first office are both published', async () => {
    const office = await makeProvider({ name: 'Checked Office' }, published);
    const draftOffice = await makeProvider({ name: 'Unchecked Office' });
    await makeRoute(office.id, { title: 'My landlord kept my deposit', matter_type: 'a' }, published);
    await makeRoute(draftOffice.id, { title: 'My deposit with an unchecked office', matter_type: 'b' }, published);
    await makeRoute(office.id, { title: 'My deposit as a draft route', matter_type: 'c' });
    const res = await search('?q=deposit');
    expect(res.body.results.routes.map((r) => r.title)).toEqual(['My landlord kept my deposit']);
    expect(res.body.results.routes[0].first_forum_name).toBe('Checked Office');
  });

  it('keeps to one library when asked and leaves the others out', async () => {
    await makeGuide({ title: 'Deposit guide' }, published);
    await makeProvider({ name: 'Deposit helper' }, published);
    const res = await search('?q=deposit&library=guides');
    expect(Object.keys(res.body.results)).toEqual(['guides']);
    const all = await search('?q=deposit&library=all');
    expect(Object.keys(all.body.results).sort()).toEqual(['guides', 'providers', 'routes']);
  });

  it('wants every word to match, so a longer question narrows the answer', async () => {
    await makeGuide({ title: 'Deposit and rent guide' }, published);
    await makeGuide({ title: 'Deposit only guide' }, published);
    const res = await search('?q=deposit%20rent');
    expect(res.body.results.guides.map((g) => g.title)).toEqual(['Deposit and rent guide']);
  });

  it('treats percent and underscore as plain characters and never as wildcards', async () => {
    await makeGuide({ title: 'Alpha guide' }, published);
    expect((await search('?q=%25%25')).body.results.guides).toEqual([]);
    expect((await search('?q=__')).body.results.guides).toEqual([]);
    expect((await search('?q=Alpha')).body.results.guides).toHaveLength(1);
  });

  it('finds a title that holds the escape character and a backslash', async () => {
    await makeGuide({ title: 'Wow! A 100% fair guide for a_b' }, published);
    expect((await search('?q=wow!')).body.results.guides).toHaveLength(1);
    expect((await search('?q=100%25')).body.results.guides).toHaveLength(1);
    expect((await search('?q=a_b')).body.results.guides).toHaveLength(1);
    expect((await search('?q=a%5Cb')).body.results.guides).toEqual([]);
  });

  it('returns at most six results for each library', async () => {
    for (let i = 0; i < 8; i += 1) await makeGuide({ title: `Deposit guide number ${i}` }, published);
    const res = await search('?q=deposit');
    expect(res.body.results.guides).toHaveLength(6);
  });

  it('answers a visitor with no account and sets nothing about who asked', async () => {
    await makeGuide({ title: 'Deposit guide' }, published);
    const res = await search('?q=deposit');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('gives empty lists, not an error, when nothing matches', async () => {
    const res = await search('?q=zzzzzz');
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual({ guides: [], routes: [], providers: [] });
  });
});

describe('GET /api/search with input that looks like search syntax', () => {
  const ODD = [
    'http://a.com/x?y=1&z', 'a:b', 'x@y.com', "it's", 'a | b', 'a & !b', '((', '))', ':*', 'a.b/c', '<->', '\\\\', 'file\\path.txt', 'a:*b', "'; DROP TABLE guides; --",
  ];

  it.each(ODD)('answers %s with a list and never a server error', async (text) => {
    const res = await search(`?q=${encodeURIComponent(text)}`);
    expect(res.status).toBe(200);
    expect(res.body.results.routes).toEqual(expect.any(Array));
  });

  it.each(ODD)('does the same on the Where to Go list for %s', async (text) => {
    const res = await request(app).get(`/api/directory/routes?q=${encodeURIComponent(text)}`);
    expect(res.status).toBe(200);
  });

  it('still finds a route when the words sit beside odd characters', async () => {
    const office = await makeProvider({ name: 'Checked Office' }, published);
    await makeRoute(office.id, { title: 'My landlord kept my deposit', matter_type: 'a' }, published);
    const res = await search(`?q=${encodeURIComponent('deposit!')}`);
    expect(res.body.results.routes.map((r) => r.title)).toEqual(['My landlord kept my deposit']);
  });
});

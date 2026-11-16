import request from 'supertest';
import app from '../../src/app.js';
import { resetDb, makeUser, makeProvider, makeRoute } from '../helpers.js';

let expert;
let abunzi;
let labour;
beforeEach(async () => {
  await resetDb();
  expert = await makeUser('legal_expert');
  abunzi = await makeProvider({ name: 'Abunzi Committee', category: 'organisation', type: 'abunzi' }, { verifiedBy: expert.user.id });
  labour = await makeProvider({ name: 'Labour Inspector', category: 'organisation', type: 'labour_inspector' }, { verifiedBy: expert.user.id });
});

const search = (query = '') => request(app).get(`/api/directory/routes${query}`);
const published = (forum, overrides) => makeRoute(forum.id, overrides, { verifiedBy: expert.user.id });

describe('where a matter must go first', () => {
  beforeEach(async () => {
    await published(abunzi, { matter_type: 'deposit', title: 'My landlord will not return my deposit', keywords: 'rent house' });
    await published(labour, { matter_type: 'wages', title: 'My employer has not paid me', keywords: 'salary job' });
  });

  it('sends a deposit problem to the Abunzi committee', async () => {
    const res = await search('?q=my%20landlord%20kept%20the%20deposit');
    expect(res.body.map((r) => [r.matter_type, r.first_forum_name])).toEqual([['deposit', 'Abunzi Committee']]);
  });

  it('sends a wages problem to the labour inspector', async () => {
    const res = await search('?q=my%20employer%20has%20not%20paid%20my%20salary');
    expect(res.body.map((r) => [r.matter_type, r.first_forum_name])).toEqual([['wages', 'Labour Inspector']]);
  });

  it('puts the route that matches more of the words first', async () => {
    await published(abunzi, { matter_type: 'rent', title: 'Rent arrears', keywords: 'landlord' });
    const res = await search('?q=landlord%20deposit');
    expect(res.body[0].matter_type).toBe('deposit');
  });

  it('finds nothing for words that match no route', async () => {
    expect((await search('?q=astronomy')).body).toEqual([]);
  });

  it('treats text that looks like SQL as plain words', async () => {
    const res = await search(`?q=${encodeURIComponent("x'; DROP TABLE matter_routes; --")}`);
    expect(res.status).toBe(200);
    expect((await search()).body).toHaveLength(2);
  });
});

describe('what the public may see', () => {
  it('hides a draft route and a route whose first body is not checked yet', async () => {
    await makeRoute(abunzi.id, { matter_type: 'draft_matter', title: 'A draft' });
    const unchecked = await makeProvider({ name: 'Unchecked Office' });
    await published(unchecked, { matter_type: 'points_nowhere', title: 'Points nowhere' });
    expect((await search()).body).toEqual([]);
  });

  it('gives the steps, the deadline and the first body for one route, without any account id', async () => {
    const route = await published(abunzi, { exclusions: 'Not for companies.' });
    const res = await request(app).get(`/api/directory/routes/${route.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deadline_days: 30, exclusions: 'Not for companies.' });
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.first_forum).toMatchObject({ name: 'Abunzi Committee' });
    expect(res.body.first_forum).not.toHaveProperty('user_id');
  });
});

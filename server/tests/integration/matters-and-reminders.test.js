import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { kigaliToday, addDays } from '../../src/services/reminders.js';
import { resetDb, makeUser, makeProvider, makeRoute, makeMatter } from '../helpers.js';

const today = kigaliToday();
const inDays = (n) => addDays(today, n);

let owner;
let other;
let expert;
let route;
beforeEach(async () => {
  await resetDb();
  owner = await makeUser('student');
  other = await makeUser('staff', 'other.person@alueducation.com');
  expert = await makeUser('legal_expert');
  const forum = await makeProvider({ name: 'Abunzi Committee', category: 'organisation', type: 'abunzi' }, { verifiedBy: expert.user.id });
  route = await makeRoute(forum.id, {
    matter_type: 'deposit', title: 'My landlord will not return my deposit',
    steps: ['Go to the Abunzi committee of your cell', 'Appeal to the sector committee'],
    deadline_days: 30, deadline_runs_from: 'the sector committee decision',
  }, { verifiedBy: expert.user.id });
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const open = (who, body) => as(who, 'post', '/api/matters').send(body);

describe('opening a matter', () => {
  it('lets a student open a matter from a route and takes its first step', async () => {
    const res = await open(owner, { route_id: route.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'My landlord will not return my deposit', next_action: 'Go to the Abunzi committee of your cell' });
  });

  it('works out the due date on the server from the checked number of days', async () => {
    const res = await open(owner, { route_id: route.id, deadline_start: inDays(-10) });
    expect(res.body.next_due).toBe(inDays(20));
  });

  it('sets reminders seven days and one day before the due date', async () => {
    const res = await open(owner, { title: 'Deadline matter', next_due: inDays(20) });
    expect(res.body.reminders.map((r) => r.send_on)).toEqual([inDays(13), inDays(19)]);
  });

  it('refuses a due date that is not a real date', async () => {
    for (const next_due of ['tomorrow', '2026-02-30']) {
      expect((await open(owner, { title: 'x', next_due })).status).toBe(400);
    }
  });

  it('refuses a start date in the future', async () => {
    expect((await open(owner, { route_id: route.id, deadline_start: inDays(3) })).status).toBe(400);
  });

  it('is for a signed-in student or staff member only', async () => {
    expect((await request(app).post('/api/matters').send({ title: 'x' })).status).toBe(401);
    expect((await open(expert, { title: 'x' })).status).toBe(403);
  });
});

describe('who can see a matter', () => {
  it('shows a person only their own matters', async () => {
    await makeMatter(owner.user.id, { title: 'Mine' });
    await makeMatter(other.user.id, { title: 'Not mine' });
    const res = await as(owner, 'get', '/api/matters');
    expect(res.body.map((m) => m.title)).toEqual(['Mine']);
  });

  it('answers 404 when someone asks for another person’s matter', async () => {
    const theirs = await makeMatter(other.user.id);
    expect((await as(owner, 'get', `/api/matters/${theirs.id}`)).status).toBe(404);
  });

});

describe('sharing a matter with a lawyer', () => {
  let lawyer;
  let office;
  let matter;
  beforeEach(async () => {
    lawyer = await makeUser('legal_expert', 'lawyer.one@example.org');
    office = await makeProvider({ name: 'Legal Aid Office', user_id: lawyer.user.id }, { verifiedBy: expert.user.id });
    matter = await makeMatter(owner.user.id, { title: 'Deposit dispute' });
  });
  const share = (who = owner, providerId = office.id) => as(who, 'post', `/api/matters/${matter.id}/share`).send({ provider_id: providerId });

  it('lets the lawyer read it without learning who the owner is', async () => {
    expect((await share()).status).toBe(200);
    const list = await as(lawyer, 'get', '/api/matters/shared');
    expect(list.body.map((m) => m.title)).toEqual(['Deposit dispute']);
    const detail = await as(lawyer, 'get', `/api/matters/${matter.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.viewer).toBe('expert');
    expect(JSON.stringify(detail.body)).not.toContain(owner.user.email);
    expect(JSON.stringify(detail.body)).not.toContain(owner.user.name);
  });

  it('ends the lawyer’s access on the very next request when the owner stops sharing', async () => {
    await share();
    expect((await as(lawyer, 'get', `/api/matters/${matter.id}`)).status).toBe(200);
    expect((await as(owner, 'delete', `/api/matters/${matter.id}/share`)).status).toBe(200);
    expect((await as(lawyer, 'get', `/api/matters/${matter.id}`)).status).toBe(404);
  });

  it('keeps it from every lawyer it was not shared with', async () => {
    await share();
    expect((await as(expert, 'get', `/api/matters/${matter.id}`)).status).toBe(404);
  });

  it('lets only the owner share it', async () => {
    expect((await share(other)).status).toBe(404);
  });

  it('refuses an office that has no lawyer account behind it', async () => {
    const noAccount = await makeProvider({ name: 'Walk-in Office' }, { verifiedBy: expert.user.id });
    expect((await share(owner, noAccount.id)).status).toBe(400);
  });

  it('ends the share when an admin links the office to a different account', async () => {
    await share();
    const admin = await makeUser('admin');
    const res = await as(admin, 'put', `/api/directory/providers/${office.id}`).send({ user_id: expert.user.id });
    expect(res.status).toBe(200);
    expect((await as(lawyer, 'get', `/api/matters/${matter.id}`)).status).toBe(404);
    const mine = await as(owner, 'get', `/api/matters/${matter.id}`);
    expect(mine.body.shared_with).toBeNull();
    expect(mine.body.events.map((e) => e.description).join(' ')).toContain('Sharing with Legal Aid Office ended');
  });

  it('ends the share when an admin changes a checked fact and the office goes back to draft', async () => {
    await share();
    const admin = await makeUser('admin');
    const res = await as(admin, 'put', `/api/directory/providers/${office.id}`).send({ address: 'KG 9 Avenue, Kigali' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect((await as(lawyer, 'get', `/api/matters/${matter.id}`)).status).toBe(404);
    const mine = await as(owner, 'get', `/api/matters/${matter.id}`);
    expect(mine.body.shared_with).toBeNull();
    expect(mine.body.events.map((e) => e.description).join(' ')).toContain('Sharing with Legal Aid Office ended');
  });

  it('keeps the share when the admin changes something that is not a checked fact', async () => {
    await share();
    const admin = await makeUser('admin');
    const res = await as(admin, 'put', `/api/directory/providers/${office.id}`).send({ meet_link: 'https://meet.google.com/abc-defg-hij' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
    expect((await as(lawyer, 'get', `/api/matters/${matter.id}`)).status).toBe(200);
  });

  it('gives the lawyer nothing while the office is not published, even if a share is still recorded', async () => {
    await share();
    await q(`UPDATE providers SET status = 'draft', verified_by = NULL, verified_at = NULL WHERE id = $1`, [office.id]);
    expect((await as(lawyer, 'get', `/api/matters/${matter.id}`)).status).toBe(404);
    expect((await as(lawyer, 'get', '/api/matters/shared')).body).toEqual([]);
  });
});

describe('the date rules', () => {
  it('counts the day in Kigali, two hours ahead of UTC', () => {
    expect(kigaliToday(new Date('2026-09-21T21:59:00Z'))).toBe('2026-09-21');
    expect(kigaliToday(new Date('2026-09-21T22:00:00Z'))).toBe('2026-09-22');
  });

  it('adds days across a month, a year and a leap day', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

});

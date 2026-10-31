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
let admin;
let route;
beforeEach(async () => {
  await resetDb();
  owner = await makeUser('student');
  other = await makeUser('staff', 'other.person@alueducation.com');
  expert = await makeUser('legal_expert');
  admin = await makeUser('admin');
  const forum = await makeProvider({ name: 'Abunzi Test Office', category: 'organisation', type: 'abunzi' },
    { verifiedBy: expert.user.id });
  route = await makeRoute(forum.id, {
    matter_type: 'deposit', title: 'My landlord will not return my deposit',
    steps: ['Go to the Abunzi committee of your cell', 'Appeal to the sector committee'],
    deadline_days: 30, deadline_runs_from: 'the sector committee decision',
  }, { verifiedBy: expert.user.id });
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const open = (who, body) => as(who, 'post', '/api/matters').send(body);
const reminderRows = (id) => q('SELECT id, status, send_on, due_on FROM reminders WHERE matter_id = $1 ORDER BY id', [id]);

describe('POST /api/matters', () => {
  it('lets a student and a staff member open a matter', async () => {
    const one = await open(owner, { title: 'My landlord kept my deposit' });
    expect(one.status).toBe(201);
    expect(one.body).toMatchObject({ title: 'My landlord kept my deposit', status: 'open', next_due: null, reminders: [] });
    expect((await open(other, { title: 'Another matter' })).status).toBe(201);
  });

  it('starts from a route and takes its title and first step', async () => {
    const res = await open(owner, { route_id: route.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'My landlord will not return my deposit', route_id: route.id,
      route_title: 'My landlord will not return my deposit',
      next_action: 'Go to the Abunzi committee of your cell',
    });
  });

  it('keeps the title the person wrote when they start from a route', async () => {
    const res = await open(owner, { route_id: route.id, title: 'Flat 4 deposit' });
    expect(res.body.title).toBe('Flat 4 deposit');
  });

  it('works out the due date from the checked number of days', async () => {
    const res = await open(owner, { route_id: route.id, deadline_start: inDays(-10) });
    expect(res.status).toBe(201);
    expect(res.body.next_due).toBe(inDays(20));
    expect(res.body.reminders).toHaveLength(2);
  });

  it('makes two reminders for a deadline weeks away', async () => {
    const res = await open(owner, { title: 'Deadline matter', next_due: inDays(20) });
    expect(res.body.reminders.map((r) => [r.send_on, r.status])).toEqual([
      [inDays(13), 'pending'], [inDays(19), 'pending']]);
  });

  it('needs a student or staff login', async () => {
    expect((await request(app).post('/api/matters').send({ title: 'x' })).status).toBe(401);
    expect((await open(expert, { title: 'x' })).status).toBe(403);
    expect((await open(admin, { title: 'x' })).status).toBe(403);
  });

  it.each([
    ['no title', {}, /short title/],
    ['a title that is blank', { title: '   ' }, /short title/],
    ['a title that is too long', { title: 'x'.repeat(201) }, /under 200/],
    ['a next step that is too long', { title: 'x', next_action: 'y'.repeat(2001) }, /too long/],
    ['a due date in words', { title: 'x', next_due: 'tomorrow' }, /next_due/],
    ['a due date that does not exist', { title: 'x', next_due: '2026-02-30' }, /next_due/],
    ['a due date that is a number', { title: 'x', next_due: 20261231 }, /next_due/],
    ['a route id that is not an id', { route_id: 'abc' }, /route_id/],
    ['a route that does not exist', { route_id: 99999 }, /not in the directory/],
    ['a start date in words', { route_id: 'ROUTE', deadline_start: 'last week' }, /deadline_start/],
    ['a start date in the future', { route_id: 'ROUTE', deadline_start: inDays(3) }, /in the future/],
  ])('refuses %s', async (_label, body, message) => {
    const payload = body.route_id === 'ROUTE' ? { ...body, route_id: route.id } : body;
    const res = await open(owner, payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });

  it('refuses a route that is still a draft', async () => {
    const draft = await makeRoute((await q('SELECT id FROM providers LIMIT 1'))[0].id, { matter_type: 'a_draft' });
    const res = await open(owner, { route_id: draft.id });
    expect(res.status).toBe(400);
  });

  it('refuses a start date for a route that has no deadline', async () => {
    const forumId = (await q('SELECT id FROM providers LIMIT 1'))[0].id;
    const noDeadline = await makeRoute(forumId, { matter_type: 'no_deadline', deadline_days: null, deadline_runs_from: null },
      { verifiedBy: expert.user.id });
    const res = await open(owner, { route_id: noDeadline.id, deadline_start: inDays(-1) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no deadline/);
  });
});

describe('GET /api/matters', () => {
  it('shows only my own matters', async () => {
    await makeMatter(owner.user.id, { title: 'Mine' });
    await makeMatter(other.user.id, { title: 'Not mine' });
    const res = await as(owner, 'get', '/api/matters');
    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.title)).toEqual(['Mine']);
  });

  it('puts the soonest deadline first and closed matters last', async () => {
    await makeMatter(owner.user.id, { title: 'Later', next_due: inDays(10) });
    await makeMatter(owner.user.id, { title: 'Soon', next_due: inDays(3) });
    await makeMatter(owner.user.id, { title: 'No date' });
    await makeMatter(owner.user.id, { title: 'Closed', next_due: inDays(1), status: 'closed' });
    const res = await as(owner, 'get', '/api/matters');
    expect(res.body.map((m) => m.title)).toEqual(['Soon', 'Later', 'No date', 'Closed']);
  });

  it('sends dates as plain strings and no internal ids', async () => {
    await makeMatter(owner.user.id, { next_due: inDays(5) });
    const [row] = (await as(owner, 'get', '/api/matters')).body;
    expect(row.next_due).toBe(inDays(5));
    expect(row).not.toHaveProperty('user_id');
  });

  it('needs a student or staff login', async () => {
    expect((await request(app).get('/api/matters')).status).toBe(401);
    expect((await as(expert, 'get', '/api/matters')).status).toBe(403);
  });
});

describe('GET /api/matters/:id', () => {
  it('shows the owner the matter with its history and reminders', async () => {
    const created = await open(owner, { title: 'With a date', next_due: inDays(20) });
    await as(owner, 'post', `/api/matters/${created.body.id}/events`).send({ description: 'Wrote to the landlord' });
    const res = await as(owner, 'get', `/api/matters/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.viewer).toBe('owner');
    expect(res.body.events.map((e) => e.description)).toEqual(['Wrote to the landlord']);
    expect(res.body.events[0].author_is_owner).toBe(true);
    expect(res.body.reminders).toHaveLength(2);
  });

  it('answers 404 and not 403 for somebody else’s matter', async () => {
    const m = await makeMatter(owner.user.id);
    const res = await as(other, 'get', `/api/matters/${m.id}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Matter not found' });
  });

  it('answers 404 for a matter that does not exist and the same for one that is not yours', async () => {
    const m = await makeMatter(owner.user.id);
    const missing = await as(other, 'get', '/api/matters/99999');
    const notYours = await as(other, 'get', `/api/matters/${m.id}`);
    expect(missing.status).toBe(notYours.status);
    expect(missing.body).toEqual(notYours.body);
    expect((await as(other, 'get', '/api/matters/abc')).status).toBe(404);
  });

  it('keeps an expert and an admin out of a matter that is not shared', async () => {
    const m = await makeMatter(owner.user.id);
    expect((await as(expert, 'get', `/api/matters/${m.id}`)).status).toBe(404);
    expect((await as(admin, 'get', `/api/matters/${m.id}`)).status).toBe(403);
    expect((await request(app).get(`/api/matters/${m.id}`)).status).toBe(401);
  });
});

describe('PUT /api/matters/:id', () => {
  it('changes the fields that were sent and keeps the rest', async () => {
    const m = await makeMatter(owner.user.id, { title: 'Old title', next_action: 'Call them' });
    const res = await as(owner, 'put', `/api/matters/${m.id}`).send({ title: 'New title' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'New title', next_action: 'Call them', status: 'open' });
  });

  it('leaves the reminders alone when the deadline did not change', async () => {
    const created = await open(owner, { title: 'Dated', next_due: inDays(20) });
    const before = await reminderRows(created.body.id);
    await as(owner, 'put', `/api/matters/${created.body.id}`).send({ title: 'Renamed' });
    expect(await reminderRows(created.body.id)).toEqual(before);
  });

  it('cancels the old reminders and makes new ones when the deadline changes', async () => {
    const created = await open(owner, { title: 'Dated', next_due: inDays(20) });
    await as(owner, 'put', `/api/matters/${created.body.id}`).send({ next_due: inDays(40) });
    const rows = await reminderRows(created.body.id);
    expect(rows.filter((r) => r.status === 'cancelled')).toHaveLength(2);
    expect(rows.filter((r) => r.status === 'pending').map((r) => r.due_on)).toEqual([inDays(40), inDays(40)]);
  });

  it('cancels the reminders when the deadline is cleared', async () => {
    const created = await open(owner, { title: 'Dated', next_due: inDays(20) });
    const res = await as(owner, 'put', `/api/matters/${created.body.id}`).send({ next_due: null });
    expect(res.body.next_due).toBeNull();
    expect((await reminderRows(created.body.id)).every((r) => r.status === 'cancelled')).toBe(true);
  });

  it('cancels the reminders when the matter is closed and makes them again when it is reopened', async () => {
    const created = await open(owner, { title: 'Dated', next_due: inDays(20) });
    await as(owner, 'put', `/api/matters/${created.body.id}`).send({ status: 'closed' });
    expect((await reminderRows(created.body.id)).every((r) => r.status === 'cancelled')).toBe(true);
    await as(owner, 'put', `/api/matters/${created.body.id}`).send({ status: 'open' });
    expect((await reminderRows(created.body.id)).filter((r) => r.status === 'pending')).toHaveLength(2);
  });

  it.each([
    ['an empty title', { title: ' ' }, /short title/],
    ['a title that is too long', { title: 'x'.repeat(201) }, /under 200/],
    ['a status that is not open or closed', { status: 'archived' }, /open or closed/],
    ['a due date that does not exist', { next_due: '2026-13-01' }, /next_due/],
    ['a next step that is too long', { next_action: 'y'.repeat(2001) }, /too long/],
  ])('refuses %s', async (_label, body, message) => {
    const m = await makeMatter(owner.user.id);
    const res = await as(owner, 'put', `/api/matters/${m.id}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });

  it('answers 404 for somebody else’s matter and refuses an expert', async () => {
    const m = await makeMatter(owner.user.id, { title: 'Mine' });
    expect((await as(other, 'put', `/api/matters/${m.id}`).send({ title: 'Taken' })).status).toBe(404);
    expect((await as(expert, 'put', `/api/matters/${m.id}`).send({ title: 'Taken' })).status).toBe(403);
    const [row] = await q('SELECT title FROM matters WHERE id = $1', [m.id]);
    expect(row.title).toBe('Mine');
  });
});

describe('POST /api/matters/:id/events', () => {
  const log = (who, id, body) => as(who, 'post', `/api/matters/${id}/events`).send(body);

  it('adds an entry dated today by default', async () => {
    const m = await makeMatter(owner.user.id);
    const res = await log(owner, m.id, { description: 'Called the landlord' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ description: 'Called the landlord', occurred_on: today, author_is_owner: true });
  });

  it('adds an entry with an earlier date and lists the newest date first', async () => {
    const m = await makeMatter(owner.user.id);
    await log(owner, m.id, { description: 'Older', occurred_on: inDays(-5) });
    await log(owner, m.id, { description: 'Newer', occurred_on: inDays(-1) });
    const res = await as(owner, 'get', `/api/matters/${m.id}`);
    expect(res.body.events.map((e) => e.description)).toEqual(['Newer', 'Older']);
  });

  it('moves the matter to the top of the recently changed', async () => {
    const m = await makeMatter(owner.user.id);
    const [{ updated_at: before }] = await q('SELECT updated_at FROM matters WHERE id = $1', [m.id]);
    await log(owner, m.id, { description: 'Something happened' });
    const [{ updated_at: after }] = await q('SELECT updated_at FROM matters WHERE id = $1', [m.id]);
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it.each([
    ['no description', {}, /Say what happened/],
    ['a blank description', { description: '  ' }, /Say what happened/],
    ['a description that is too long', { description: 'x'.repeat(2001) }, /too long/],
    ['a date in words', { description: 'x', occurred_on: 'yesterday' }, /occurred_on/],
    ['a date in the future', { description: 'x', occurred_on: inDays(2) }, /in the future/],
  ])('refuses %s', async (_label, body, message) => {
    const m = await makeMatter(owner.user.id);
    const res = await log(owner, m.id, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });

  it('answers 404 for somebody else’s matter and 401 with no login', async () => {
    const m = await makeMatter(owner.user.id);
    expect((await log(other, m.id, { description: 'x' })).status).toBe(404);
    expect((await request(app).post(`/api/matters/${m.id}/events`).send({ description: 'x' })).status).toBe(401);
  });
});

describe('DELETE /api/matters/:id', () => {
  it('erases the matter with its history and reminders', async () => {
    const created = await open(owner, { title: 'To erase', next_due: inDays(20) });
    await as(owner, 'post', `/api/matters/${created.body.id}/events`).send({ description: 'A step' });
    const res = await as(owner, 'delete', `/api/matters/${created.body.id}`);
    expect(res.status).toBe(204);
    for (const table of ['matters', 'matter_events', 'reminders']) {
      const [{ n }] = await q(`SELECT count(*)::int AS n FROM ${table}`);
      expect(n).toBe(0);
    }
  });

  it('answers 404 for somebody else’s matter and a matter already erased', async () => {
    const m = await makeMatter(owner.user.id);
    expect((await as(other, 'delete', `/api/matters/${m.id}`)).status).toBe(404);
    expect((await as(owner, 'delete', `/api/matters/${m.id}`)).status).toBe(204);
    expect((await as(owner, 'delete', `/api/matters/${m.id}`)).status).toBe(404);
  });

  it('refuses an expert', async () => {
    const m = await makeMatter(owner.user.id);
    expect((await as(expert, 'delete', `/api/matters/${m.id}`)).status).toBe(403);
  });
});

describe('the database rules for matters', () => {
  it('refuses a matter with no owner', async () => {
    await expect(q(`INSERT INTO matters (title) VALUES ('No owner')`)).rejects.toThrow(/user_id/);
  });

  it('refuses a reminder that is sent before its own date is possible', async () => {
    const m = await makeMatter(owner.user.id);
    await expect(q(`INSERT INTO reminders (matter_id, due_on, send_on) VALUES ($1,$2,$3)`, [m.id, inDays(1), inDays(5)]))
      .rejects.toThrow(/reminders_check/);
  });

  it('refuses a reminder marked sent with no time it was sent', async () => {
    const m = await makeMatter(owner.user.id);
    await expect(q(`INSERT INTO reminders (matter_id, due_on, send_on, status) VALUES ($1,$2,$2,'sent')`, [m.id, inDays(1)]))
      .rejects.toThrow(/reminders_check/);
  });
});

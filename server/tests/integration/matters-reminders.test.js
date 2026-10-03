// Matters and reminders.
// A matter is private to its owner. A deadline counted from a checked route is worked out on
// the server. A reminder is sent before its date or recorded as missed, never sent late.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';
import {
  runDueReminders, scheduleReminders, reminderSummary, addDays, kigaliToday,
} from '../../src/services/reminders.js';

let admin, expert, student, other, staffer;

beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin', 'admin.m@alustudent.com');
  expert = await makeUser('legal_expert', 'expert.m@example.org');
  student = await makeUser('student', 'student.m@alustudent.com');
  other = await makeUser('student', 'other.m@alustudent.com');
  staffer = await makeUser('staff', 'staff.m@alueducation.com');
});

async function publishedRoute(overrides = {}) {
  const forum = await makeProvider({ type: 'abunzi' }, { verifiedBy: expert.user.id });
  const [r] = await q(
    `INSERT INTO matter_routes (matter_type, title, first_forum_id, legal_basis, steps, deadline_days,
                                deadline_runs_from, status, verified_by, verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'published',$8,now()) RETURNING *`,
    [overrides.matter_type || 'small_civil_claim', 'Someone kept my deposit', forum.id, 'Art. 10',
     ['Go to the Abunzi committee', 'Appeal'], 'deadline_days' in overrides ? overrides.deadline_days : 30,
     overrides.deadline_days === null ? null : 'the decision', expert.user.id]);
  return r;
}

const post = (user, body) => request(app).post('/api/matters').set('Authorization', user.auth).send(body);

describe('opening and reading a matter', () => {
  it('opens a plain matter and lists it for its owner only', async () => {
    const res = await post(student, { title: 'Deposit', next_action: 'Write to landlord', next_due: addDays(kigaliToday(), 20) });
    expect(res.status).toBe(201);
    expect(res.body.reminders).toHaveLength(2); // 7 days and 1 day before

    const mine = await request(app).get('/api/matters').set('Authorization', student.auth);
    expect(mine.body.map((m) => m.title)).toEqual(['Deposit']);
    const theirs = await request(app).get('/api/matters').set('Authorization', other.auth);
    expect(theirs.body).toEqual([]);
  });

  it('answers 404, not 403, for somebody else’s matter, so it does not say the matter exists', async () => {
    const { body } = await post(student, { title: 'Private' });
    for (const u of [other, staffer, expert]) {
      expect((await request(app).get(`/api/matters/${body.id}`).set('Authorization', u.auth)).status).toBe(404);
    }
    expect((await request(app).put(`/api/matters/${body.id}`).set('Authorization', other.auth).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/api/matters/${body.id}`).set('Authorization', other.auth)).status).toBe(404);
    expect((await request(app).post(`/api/matters/${body.id}/events`).set('Authorization', other.auth).send({ description: 'x' })).status).toBe(404);
  });

  it('has no anonymous or admin access at all', async () => {
    expect((await request(app).get('/api/matters')).status).toBe(401);
    expect((await request(app).get('/api/matters').set('Authorization', admin.auth)).status).toBe(403);
    expect((await request(app).get('/api/matters').set('Authorization', expert.auth)).status).toBe(403);
  });

  it('counts the deadline from a checked route on the server', async () => {
    const route = await publishedRoute();
    const start = addDays(kigaliToday(), -3);
    const res = await post(student, { route_id: route.id, deadline_start: start });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Someone kept my deposit');
    expect(res.body.next_action).toBe('Go to the Abunzi committee');
    expect(res.body.next_due).toBe(addDays(start, 30));
  });

  it('refuses a route that is not published, a future start and a deadline the route does not have', async () => {
    const route = await publishedRoute();
    await q(`UPDATE matter_routes SET status='draft', verified_by=NULL, verified_at=NULL WHERE id=$1`, [route.id]);
    expect((await post(student, { route_id: route.id })).status).toBe(400);

    const live = await publishedRoute({ matter_type: 'another' });
    expect((await post(student, { route_id: live.id, deadline_start: addDays(kigaliToday(), 2) })).status).toBe(400);

    const none = await publishedRoute({ matter_type: 'no_deadline', deadline_days: null });
    expect((await post(student, { route_id: none.id, deadline_start: kigaliToday() })).body.error).toMatch(/no deadline/);
  });

  it('checks that dates are real calendar dates', async () => {
    expect((await post(student, { title: 'x', next_due: '2026-02-30' })).status).toBe(400);
    expect((await post(student, { title: 'x', next_due: 'tomorrow' })).status).toBe(400);
    expect((await post(student, { title: '' })).status).toBe(400);
  });

  it('returns dates exactly as stored, with no timezone shift', async () => {
    const res = await post(student, { title: 'Date', next_due: '2027-01-15' });
    const got = await request(app).get(`/api/matters/${res.body.id}`).set('Authorization', student.auth);
    expect(got.body.next_due).toBe('2027-01-15');
    expect(got.body.reminders.map((r) => r.send_on)).toEqual(['2027-01-08', '2027-01-14']);
  });
});

describe('logging what has been done', () => {
  it('records steps in date order and marks the owner’s own entries', async () => {
    const { body } = await post(student, { title: 'Wages' });
    const today = kigaliToday();
    await request(app).post(`/api/matters/${body.id}/events`).set('Authorization', student.auth)
      .send({ occurred_on: addDays(today, -5), description: 'Wrote to HR' });
    await request(app).post(`/api/matters/${body.id}/events`).set('Authorization', student.auth)
      .send({ description: 'Went to the labour inspector' });
    const got = await request(app).get(`/api/matters/${body.id}`).set('Authorization', student.auth);
    expect(got.body.events.map((e) => e.description)).toEqual(['Went to the labour inspector', 'Wrote to HR']);
    expect(got.body.events.every((e) => e.author_is_owner)).toBe(true);
  });

  it('refuses an entry dated in the future', async () => {
    const { body } = await post(student, { title: 'Wages' });
    const res = await request(app).post(`/api/matters/${body.id}/events`).set('Authorization', student.auth)
      .send({ occurred_on: addDays(kigaliToday(), 1), description: 'Tomorrow' });
    expect(res.status).toBe(400);
  });
});

describe('reminders', () => {
  it('sends a reminder on its day, and only once', async () => {
    const today = '2026-10-01';
    const [m] = await q(`INSERT INTO matters (user_id, title, next_due) VALUES ($1,'x','2026-10-08') RETURNING id`, [student.user.id]);
    await scheduleReminders(m.id, '2026-10-08', today);

    expect(await runDueReminders('2026-09-30')).toMatchObject({ sent: 0 });
    expect(await runDueReminders('2026-10-01')).toMatchObject({ sent: 1 }); // the 7-day one
    expect(await runDueReminders('2026-10-01')).toMatchObject({ sent: 0 }); // not twice
    expect(await runDueReminders('2026-10-07')).toMatchObject({ sent: 1 }); // the 1-day one
    expect(await reminderSummary()).toMatchObject({ sent: 2, missed: 0, pending: 0, sent_late: 0 });
  });

  it('never sends a reminder after its date, and records it as missed', async () => {
    const [m] = await q(`INSERT INTO matters (user_id, title, next_due) VALUES ($1,'x','2026-10-08') RETURNING id`, [student.user.id]);
    await scheduleReminders(m.id, '2026-10-08', '2026-10-01');
    const res = await runDueReminders('2026-10-09'); // the scheduler was down for a week
    expect(res).toMatchObject({ sent: 0, missed: 2 });
    expect(await reminderSummary()).toMatchObject({ sent: 0, missed: 2 });
  });

  it('moves a reminder to today when the deadline is close, and merges two on the same day', async () => {
    const [m] = await q(`INSERT INTO matters (user_id, title) VALUES ($1,'x') RETURNING id`, [student.user.id]);
    const rows = await scheduleReminders(m.id, '2026-10-02', '2026-10-01');
    expect(rows.map((r) => r.send_on)).toEqual(['2026-10-01']);
  });

  it('cancels pending reminders when the deadline changes or the matter is closed', async () => {
    const { body } = await post(student, { title: 'x', next_due: addDays(kigaliToday(), 20) });
    await request(app).put(`/api/matters/${body.id}`).set('Authorization', student.auth).send({ next_due: addDays(kigaliToday(), 30) });
    let rows = await q(`SELECT status FROM reminders WHERE matter_id=$1 ORDER BY id`, [body.id]);
    expect(rows.map((r) => r.status)).toEqual(['cancelled', 'cancelled', 'pending', 'pending']);

    await request(app).put(`/api/matters/${body.id}`).set('Authorization', student.auth).send({ status: 'closed' });
    rows = await q(`SELECT status FROM reminders WHERE matter_id=$1 AND status='pending'`, [body.id]);
    expect(rows).toHaveLength(0);
  });
});

describe('erasing a matter', () => {
  it('deletes the matter with its history and reminders', async () => {
    const { body } = await post(student, { title: 'x', next_due: addDays(kigaliToday(), 20) });
    await request(app).post(`/api/matters/${body.id}/events`).set('Authorization', student.auth).send({ description: 'a' });
    expect((await request(app).delete(`/api/matters/${body.id}`).set('Authorization', student.auth)).status).toBe(204);
    expect(await q('SELECT 1 FROM matter_events WHERE matter_id=$1', [body.id])).toHaveLength(0);
    expect(await q('SELECT 1 FROM reminders WHERE matter_id=$1', [body.id])).toHaveLength(0);
  });
});

import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { addDays, kigaliToday } from '../../src/services/reminders.js';
import { resetDb, makeUser, makeProvider, makeRoute, makeGuide, makeMatter } from '../helpers.js';

let admin;
let expert;
let student;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
  expert = await makeUser('legal_expert');
  student = await makeUser('student');
});

const stats = async () => (await request(app).get('/api/admin/stats').set('Authorization', admin.auth)).body;

describe('GET /api/admin/stats', () => {
  it('has every number even when there is nothing yet', async () => {
    await resetDb();
    const adminAgain = await makeUser('admin');
    const res = await request(app).get('/api/admin/stats').set('Authorization', adminAgain.auth);
    expect(res.status).toBe(200);
    expect(res.body.guides).toEqual({ draft: 0, pending_review: 0, published: 0 });
    expect(res.body.directory).toEqual({
      providers: { draft: 0, pending_review: 0, published: 0 },
      routes: { draft: 0, pending_review: 0, published: 0 },
      stale: 0,
    });
    expect(res.body.bookings).toEqual({
      total: 0, anonymous: 0, by_status: { requested: 0, accepted: 0, declined: 0, completed: 0 } });
    expect(res.body.questions).toEqual({ total: 0, anonymous: 0, open: 0 });
    expect(res.body.matters).toEqual({ total: 0, open: 0, shared: 0 });
    expect(res.body.reminders).toEqual({ pending: 0, sent: 0, missed: 0, cancelled: 0, sent_late: 0 });
    expect(res.body.users).toMatchObject({ admin: 1, student: 0, deactivated: 0 });
  });

  it('counts the guides and the directory by state', async () => {
    await makeGuide({ title: 'One' }, { verifiedBy: expert.user.id });
    await makeGuide({ title: 'Two' });
    const forum = await makeProvider({ name: 'Office A' }, { verifiedBy: expert.user.id });
    await makeProvider({ name: 'Office B' });
    await makeRoute(forum.id, {}, { verifiedBy: expert.user.id });
    const s = await stats();
    expect(s.guides).toEqual({ draft: 1, pending_review: 0, published: 1 });
    expect(s.directory.providers).toEqual({ draft: 1, pending_review: 0, published: 1 });
    expect(s.directory.routes).toEqual({ draft: 0, pending_review: 0, published: 1 });
  });

  it('counts published entries that were not checked for over 180 days', async () => {
    const fresh = await makeProvider({ name: 'Fresh' }, { verifiedBy: expert.user.id });
    const old = await makeProvider({ name: 'Old' }, { verifiedBy: expert.user.id });
    await q('UPDATE providers SET last_checked_at = CURRENT_DATE - 200 WHERE id = $1', [old.id]);
    expect((await stats()).directory.stale).toBe(1);
    expect(fresh.id).toBeTruthy();
  });

  it('counts bookings and questions and says how many are anonymous', async () => {
    const lawyer = await makeProvider(
      { name: 'Lawyer', user_id: expert.user.id, bookable: true, meet_link: 'https://meet.google.com/aaa-bbbb-ccc' },
      { verifiedBy: expert.user.id });
    await q(`INSERT INTO bookings (user_id, provider_id, slot) VALUES ($1,$2, now() + interval '1 day')`, [student.user.id, lawyer.id]);
    await q(`INSERT INTO bookings (anon_token, provider_id, slot, status) VALUES ('hash-one',$1, now() + interval '2 days', 'accepted')`, [lawyer.id]);
    await q(`INSERT INTO questions (user_id, text) VALUES ($1, 'Signed in')`, [student.user.id]);
    await q(`INSERT INTO questions (anon_token, text) VALUES ('hash-two', 'Anonymous')`);
    const s = await stats();
    expect(s.bookings).toEqual({ total: 2, anonymous: 1, by_status: { requested: 1, accepted: 1, declined: 0, completed: 0 } });
    expect(s.questions).toEqual({ total: 2, anonymous: 1, open: 2 });
  });

  it('counts matters and reminders and the reminders that went late', async () => {
    const today = kigaliToday();
    const m = await makeMatter(student.user.id, { next_due: addDays(today, 5) });
    await makeMatter(student.user.id, { status: 'closed' });
    await q(`INSERT INTO reminders (matter_id, due_on, send_on) VALUES ($1,$2,$2)`, [m.id, addDays(today, 5)]);
    await q(`INSERT INTO reminders (matter_id, due_on, send_on, status, sent_at) VALUES ($1,$2,$2,'sent', now())`, [m.id, addDays(today, 5)]);
    await q(`INSERT INTO reminders (matter_id, due_on, send_on, status, sent_at) VALUES ($1,$2,$3,'sent', now())`,
      [m.id, addDays(today, -3), addDays(today, -9)]);
    await q(`INSERT INTO reminders (matter_id, due_on, send_on, status) VALUES ($1,$2,$3,'missed')`,
      [m.id, addDays(today, -4), addDays(today, -10)]);
    const s = await stats();
    expect(s.matters).toEqual({ total: 2, open: 1, shared: 0 });
    expect(s.reminders).toEqual({ pending: 1, sent: 2, missed: 1, cancelled: 0, sent_late: 1 });
  });

  it('counts the accounts by role and the ones switched off', async () => {
    await makeUser('staff', 'staff.person@alueducation.com');
    await q('UPDATE users SET deactivated_at = now() WHERE id = $1', [student.user.id]);
    const s = await stats();
    expect(s.users).toEqual({ student: 1, staff: 1, legal_expert: 1, admin: 1, deactivated: 1 });
  });

  it('holds counts only and no personal data', async () => {
    await makeMatter(student.user.id, { title: 'A private title' });
    await q(`INSERT INTO questions (user_id, text) VALUES ($1, 'A private question')`, [student.user.id]);
    const text = JSON.stringify(await stats());
    expect(text).not.toContain('@');
    expect(text).not.toContain('A private');
    expect(text).not.toContain('Test student');
  });
});

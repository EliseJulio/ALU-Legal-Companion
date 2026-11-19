import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { q, pool } from '../../src/db.js';
import { whenSettled } from '../../src/services/notify.js';
import { runDueBookingReminders } from '../../src/services/bookingReminders.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

// Monday 09:00 in Kigali. Default hours apply: Monday to Friday, 09:00 to 17:00.
const FIXED = new Date('2026-11-23T07:00:00Z');
const MEET = 'https://meet.google.com/aaa-bbbb-ccc';
const MSG_NOT_AVAILABLE = 'That time is not available. Choose one of the times shown.';
// Kigali Tuesday 10:00, Tuesday 10:30 and Thursday 10:00.
const TUE_10 = '2026-11-24T08:00:00.000Z';
const TUE_1030 = '2026-11-24T08:30:00.000Z';
const THU_10 = '2026-11-26T08:00:00.000Z';
const KEEP_REAL_TIMERS = ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback'];

let expert, otherExpert, student, staff, provider, mails, savedBudget;

beforeAll(() => jest.useFakeTimers({ now: FIXED, doNotFake: KEEP_REAL_TIMERS }));
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  savedBudget = process.env.DAILY_EMAIL_BUDGET;
  process.env.DAILY_EMAIL_BUDGET = '';
  mails = [];
  jest.spyOn(console, 'log').mockImplementation((text) => { mails.push(String(text)); });
  await resetDb();
  jest.setSystemTime(FIXED);
  expert = await makeUser('legal_expert', 'expert@example.org');
  otherExpert = await makeUser('legal_expert', 'other.expert@example.org');
  student = await makeUser('student', 'student@alustudent.com');
  staff = await makeUser('staff', 'staff@alustudent.com');
  provider = await makeProvider({ name: 'Bookable Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', user_id: expert.user.id, bookable: true, meet_link: MEET }, { verifiedBy: expert.user.id });
});
afterEach(async () => {
  // Mail started by one test must not print into the next test's list.
  await whenSettled();
  jest.restoreAllMocks();
  process.env.DAILY_EMAIL_BUDGET = savedBudget;
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const body = (o = {}) => ({ provider_id: provider.id, slot: TUE_10, topic: 'My landlord kept my deposit', ...o });
const book = (who, slot) => as(who, 'post', '/api/bookings').send(body({ slot }));
const bookAnon = (slot) => request(app).post('/api/bookings/anonymous').send(body({ slot }));
const setStatus = (who, id, status) => as(who, 'post', `/api/bookings/${id}/status`).send({ status });
const propose = (who, id, slot) => as(who, 'post', `/api/bookings/${id}/propose`).send({ slot });
const answer = (who, id, action) => as(who, 'post', `/api/bookings/${id}/proposal`).send({ action });
const reschedule = (who, id, slot) => as(who, 'post', `/api/bookings/${id}/reschedule`).send({ slot });
const slotsFor = (from, to) => request(app).get(`/api/bookings/slots/${provider.id}`).query({ from, to });
const sentTo = (address) => mails.filter((m) => m.includes(`To:      ${address}`));
const subjectOf = (text) => mails.filter((m) => m.includes(`Subject: ${text}`));
const reminders = (id) => q('SELECT status FROM booking_reminders WHERE booking_id = $1 ORDER BY recipient, kind', [id]);
const row = async (id) => (await q('SELECT status, slot, proposed_slot, proposed_at FROM bookings WHERE id = $1', [id]))[0];
// Waits for mail already started, then forgets it, so the next check counts only new mail.
const settle = async () => {
  await whenSettled();
  mails.length = 0;
};

it('lets the linked lawyer suggest only an open time for a waiting request, and mails the owner the time without the topic', async () => {
  const asked = await book(student, TUE_10);
  const id = asked.body.id;
  expect((await propose(otherExpert, id, THU_10)).status).toBe(404);
  expect((await propose(student, id, THU_10)).status).toBe(403);
  const off = await propose(expert, id, '2026-11-26T08:15:00.000Z');
  expect({ status: off.status, error: off.body.error }).toEqual({ status: 400, error: MSG_NOT_AVAILABLE });
  const same = await propose(expert, id, TUE_10);
  expect({ status: same.status, error: same.body.error }).toEqual({ status: 400, error: 'That is the time already asked for.' });
  const ok = await propose(expert, id, THU_10);
  expect({ status: ok.status, proposed: ok.body.proposed_slot, state: ok.body.status }).toEqual({ status: 200, proposed: THU_10, state: 'requested' });
  await whenSettled();
  const sent = sentTo('student@alustudent.com').filter((m) => m.includes('Subject: The lawyer suggested another time'));
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatch(/26 November 2026/);
  expect(sent[0]).toContain('/appointments');
  expect(sent[0]).not.toContain('My landlord');
  await settle();
  // A second suggestion replaces the first.
  expect((await propose(expert, id, TUE_1030)).body.proposed_slot).toBe(TUE_1030);
  expect((await row(id)).proposed_slot).toEqual(new Date(TUE_1030));
  // A request that is no longer waiting cannot be given a new time.
  const held = await book(staff, TUE_1030);
  await setStatus(expert, held.body.id, 'accepted');
  const late = await propose(expert, held.body.id, THU_10);
  expect({ status: late.status, error: late.body.error }).toEqual({ status: 400, error: 'Only a waiting request can get a suggested time.' });
});

it('moves the booking to the suggested time when the person accepts, makes its reminders and sends both accepted notices', async () => {
  const asked = await book(student, TUE_10);
  await propose(expert, asked.body.id, THU_10);
  await settle();
  const res = await answer(student, asked.body.id, 'accept');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ status: 'accepted', proposed_slot: null });
  expect(new Date(res.body.slot).toISOString()).toBe(THU_10);
  expect((await reminders(asked.body.id)).map((r) => r.status)).toEqual(['pending', 'pending', 'pending', 'pending']);
  await whenSettled();
  expect(sentTo('student@alustudent.com').filter((m) => m.includes('Subject: Your consultation was accepted'))).toHaveLength(1);
  const told = sentTo('expert@example.org').filter((m) => m.includes('Subject: The person accepted your suggested time'));
  expect(told).toHaveLength(1);
  expect(told[0]).toMatch(/26 November 2026/);
  expect(told[0]).not.toContain('My landlord');
});

it('refuses an accept with 400 when another booking has taken the suggested time, and keeps the suggestion', async () => {
  const asked = await book(student, TUE_10);
  await propose(expert, asked.body.id, THU_10);
  const other = await book(staff, THU_10);
  expect((await setStatus(expert, other.body.id, 'accepted')).status).toBe(200);
  const res = await answer(student, asked.body.id, 'accept');
  expect({ status: res.status, error: res.body.error }).toEqual({ status: 400, error: MSG_NOT_AVAILABLE });
  expect(await row(asked.body.id)).toMatchObject({ status: 'requested' });
  expect((await row(asked.body.id)).proposed_slot).not.toBeNull();
});

it('clears a suggestion that the person declines, leaves the request waiting and tells the lawyer the time only', async () => {
  const asked = await book(student, TUE_10);
  expect((await answer(student, asked.body.id, 'decline')).body.error).toBe('There is no suggested time to answer.');
  await propose(expert, asked.body.id, THU_10);
  await settle();
  const res = await answer(student, asked.body.id, 'decline');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ status: 'requested', proposed_slot: null });
  await whenSettled();
  const told = sentTo('expert@example.org').filter((m) => m.includes('Subject: The person did not take the time you suggested'));
  expect(told).toHaveLength(1);
  expect(told[0]).toMatch(/26 November 2026/);
  expect(told[0]).not.toContain('My landlord');
  // A pending suggestion is cleared when the lawyer declines the request or the person cancels it.
  await propose(expert, asked.body.id, THU_10);
  expect((await setStatus(expert, asked.body.id, 'declined')).body).toMatchObject({ status: 'declined', proposed_slot: null });
  const other = await book(staff, TUE_1030);
  await propose(expert, other.body.id, THU_10);
  expect((await as(staff, 'post', `/api/bookings/${other.body.id}/cancel`)).body).toMatchObject({ status: 'cancelled', proposed_slot: null });
});

it('lets an anonymous person accept or decline by the code in the body, mails no one who is named, and answers an unknown code with 404', async () => {
  const made = await bookAnon(TUE_10);
  const token = made.body.anon_token;
  await propose(expert, made.body.id, THU_10);
  await settle();
  const declined = await request(app).post('/api/bookings/anon/proposal').send({ anon_token: token, action: 'decline' });
  expect(declined.body).toMatchObject({ status: 'requested', proposed_slot: null });
  await whenSettled();
  expect(subjectOf('The person did not take the time you suggested')).toHaveLength(1);
  await settle();
  await propose(expert, made.body.id, THU_10);
  await settle();
  const accepted = await request(app).post('/api/bookings/anon/proposal').send({ anon_token: token.toLowerCase(), action: 'accept' });
  expect({ status: accepted.status, state: accepted.body.status }).toEqual({ status: 200, state: 'accepted' });
  await whenSettled();
  const told = subjectOf('The person accepted your suggested time');
  expect(told).toHaveLength(1);
  expect(told[0].toLowerCase()).not.toContain('anonym');
  expect(mails.some((m) => m.includes('Subject: The lawyer suggested another time') || m.includes('Subject: Your consultation was accepted'))).toBe(false);
  const unknown = await request(app).post('/api/bookings/anon/proposal').send({ anon_token: 'ABCD-EFGH-JKMN-PQRS', action: 'accept' });
  expect({ status: unknown.status, error: unknown.body.error }).toEqual({ status: 404, error: 'No booking found for this token' });
});

it('moves an accepted consultation to a new time that waits for the lawyer, frees the old slot, cancels its reminders and mails the lawyer the new time', async () => {
  const asked = await book(student, TUE_10);
  await setStatus(expert, asked.body.id, 'accepted');
  await settle();
  const res = await reschedule(student, asked.body.id, THU_10);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ status: 'requested', proposed_slot: null });
  expect(new Date(res.body.slot).toISOString()).toBe(THU_10);
  expect((await reminders(asked.body.id)).every((r) => r.status === 'cancelled')).toBe(true);
  const free = await slotsFor('2026-11-24', '2026-11-24');
  expect(free.body.days[0].slots).toContain(TUE_10);
  await whenSettled();
  const moved = sentTo('expert@example.org').filter((m) => m.includes('Subject: A consultation time was changed'));
  expect(moved).toHaveLength(1);
  expect(moved[0]).toMatch(/26 November 2026/);
  expect(moved[0]).toContain('/expert/appointments');
  expect(moved[0]).not.toContain('My landlord');
  expect(moved[0]).not.toContain('Test student');
});

it('refuses a reschedule to a time that is not open, to the time already booked, after the start, and for someone else’s booking', async () => {
  const mine = await book(student, TUE_10);
  const notOpen = await reschedule(student, mine.body.id, '2026-11-24T08:15:00.000Z');
  expect({ status: notOpen.status, error: notOpen.body.error }).toEqual({ status: 400, error: MSG_NOT_AVAILABLE });
  const same = await reschedule(student, mine.body.id, TUE_10);
  expect({ status: same.status, error: same.body.error }).toEqual({ status: 400, error: 'That is the time you already have.' });
  expect((await reschedule(staff, mine.body.id, THU_10)).status).toBe(404);
  // Moving an accepted consultation back to waiting must respect the limit of three open requests.
  await setStatus(expert, mine.body.id, 'accepted');
  for (const slot of [TUE_1030, '2026-11-24T09:00:00.000Z', '2026-11-24T09:30:00.000Z']) {
    expect((await book(student, slot)).status).toBe(201);
  }
  const capped = await reschedule(student, mine.body.id, THU_10);
  expect({ status: capped.status, error: capped.body.error }).toEqual({
    status: 400, error: 'You already have open requests with this lawyer. Wait for an answer or cancel one.',
  });
  expect((await row(mine.body.id)).status).toBe('accepted');
  jest.setSystemTime(new Date('2026-11-24T08:05:00Z')); // the consultation started at 10:00 Kigali
  const started = await reschedule(student, mine.body.id, THU_10);
  expect({ status: started.status, error: started.body.error }).toEqual({ status: 400, error: 'This consultation can no longer be moved.' });
  expect((await row(mine.body.id)).slot).toEqual(new Date(TUE_10));
});

it('shows the suggested time on the three reads, and the migration adds its columns and its check', async () => {
  const signed = await book(student, TUE_10);
  const anon = await bookAnon(TUE_1030);
  await propose(expert, signed.body.id, THU_10);
  await propose(expert, anon.body.id, THU_10);
  const mine = await as(student, 'get', '/api/bookings/mine');
  expect(mine.body.find((b) => b.id === signed.body.id).proposed_slot).toBe(THU_10);
  const listed = await as(expert, 'get', '/api/bookings/expert');
  expect(listed.body.find((b) => b.id === anon.body.id).proposed_slot).toBe(THU_10);
  const tokenRead = await request(app).post('/api/bookings/anon/status').send({ code: anon.body.anon_token });
  expect(tokenRead.body.proposed_slot).toBe(THU_10);
  // The page needs the entry number to offer the open times when the person changes the time.
  expect(tokenRead.body.provider_id).toBe(provider.id);
  expect(listed.body.find((b) => b.id === anon.body.id).provider_id).toBe(provider.id);
  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'bookings' AND column_name IN ('proposed_slot', 'proposed_at')
    ORDER BY column_name`);
  expect(columns).toEqual([
    { column_name: 'proposed_at', data_type: 'timestamp with time zone' },
    { column_name: 'proposed_slot', data_type: 'timestamp with time zone' },
  ]);
  await expect(q(`UPDATE bookings SET status = 'accepted' WHERE id = $1`, [signed.body.id]))
    .rejects.toThrow(/bookings_proposal_needs_request/);
});

const reminderRows = async (id) => (await q(
  'SELECT recipient, kind, send_at, status, sent_at FROM booking_reminders WHERE booking_id = $1 ORDER BY recipient, kind', [id]))
  .map((r) => [r.recipient, r.kind, new Date(r.send_at).toISOString(), r.status]);
const THU_DAY = '2026-11-25T08:00:00.000Z';
const THU_HOUR = '2026-11-26T07:00:00.000Z';
const TUE_DAY = '2026-11-23T08:00:00.000Z';
const TUE_HOUR = '2026-11-24T07:00:00.000Z';

it('re-arms the reminders when a moved consultation is accepted again at another time', async () => {
  const asked = await book(student, TUE_10);
  await setStatus(expert, asked.body.id, 'accepted');
  expect((await reschedule(student, asked.body.id, THU_10)).status).toBe(200);
  expect((await reminders(asked.body.id)).every((r) => r.status === 'cancelled')).toBe(true);
  expect((await setStatus(expert, asked.body.id, 'accepted')).status).toBe(200);
  expect(await reminderRows(asked.body.id)).toEqual([
    ['lawyer', 'day', THU_DAY, 'pending'],
    ['lawyer', 'hour', THU_HOUR, 'pending'],
    ['owner', 'day', THU_DAY, 'pending'],
    ['owner', 'hour', THU_HOUR, 'pending'],
  ]);
});

it('leaves a day reminder already sent for the same time alone, so it is not sent twice', async () => {
  const asked = await book(student, TUE_10);
  await setStatus(expert, asked.body.id, 'accepted');
  expect(await runDueBookingReminders(new Date(TUE_DAY))).toMatchObject({ sent: 2 });
  // Moved away and back while still waiting. The sent day reminders are for the same time again.
  await reschedule(student, asked.body.id, THU_10);
  await reschedule(student, asked.body.id, TUE_10);
  await setStatus(expert, asked.body.id, 'accepted');
  expect(await reminderRows(asked.body.id)).toEqual([
    ['lawyer', 'day', TUE_DAY, 'sent'],
    ['lawyer', 'hour', TUE_HOUR, 'pending'],
    ['owner', 'day', TUE_DAY, 'sent'],
    ['owner', 'hour', TUE_HOUR, 'pending'],
  ]);
  expect(await runDueBookingReminders(new Date(TUE_DAY))).toMatchObject({ sent: 0 });
});

it('re-arms a day reminder that was already sent for the old time', async () => {
  const asked = await book(student, TUE_10);
  await setStatus(expert, asked.body.id, 'accepted');
  expect(await runDueBookingReminders(new Date(TUE_DAY))).toMatchObject({ sent: 2 });
  await reschedule(student, asked.body.id, THU_10);
  await setStatus(expert, asked.body.id, 'accepted');
  expect(await reminderRows(asked.body.id)).toEqual([
    ['lawyer', 'day', THU_DAY, 'pending'],
    ['lawyer', 'hour', THU_HOUR, 'pending'],
    ['owner', 'day', THU_DAY, 'pending'],
    ['owner', 'hour', THU_HOUR, 'pending'],
  ]);
});

it('lets no more than three open requests exist when two accepted consultations are moved back at once', async () => {
  const accepted1 = await book(student, TUE_10);
  const accepted2 = await book(student, TUE_1030);
  await setStatus(expert, accepted1.body.id, 'accepted');
  await setStatus(expert, accepted2.body.id, 'accepted');
  // Two open requests already, so one more is the limit and a second one is over it.
  expect((await book(student, '2026-11-24T09:00:00.000Z')).status).toBe(201);
  expect((await book(student, '2026-11-24T09:30:00.000Z')).status).toBe(201);
  // Both moves read the count before either writes, so each sees two open requests. The read waits
  // for the other move to read too, or for a short time when the other move is held back.
  const realQuery = pool.query.bind(pool);
  const waiting = [];
  let flushed = false;
  const flush = () => {
    if (flushed) return;
    flushed = true;
    waiting.splice(0).forEach((go) => go());
  };
  const spy = jest.spyOn(pool, 'query').mockImplementation((text, params) => {
    if (flushed || !/SELECT count\(\*\)::int AS open FROM bookings/.test(text)) return realQuery(text, params);
    return new Promise((resolve, reject) => {
      waiting.push(() => realQuery(text, params).then(resolve, reject));
      if (waiting.length === 2) flush();
      else setTimeout(flush, 300);
    });
  });
  const [a, b] = await Promise.all([
    reschedule(student, accepted1.body.id, THU_10),
    reschedule(student, accepted2.body.id, '2026-11-26T08:30:00.000Z'),
  ]);
  spy.mockRestore();
  expect([a.status, b.status].sort()).toEqual([200, 400]);
  const refused = a.status === 400 ? a : b;
  expect(refused.body.error).toBe('You already have open requests with this lawyer. Wait for an answer or cancel one.');
  const [{ open }] = await q(
    `SELECT count(*)::int AS open FROM bookings WHERE user_id = $1 AND provider_id = $2 AND status = 'requested'`,
    [student.user.id, provider.id]);
  expect(open).toBe(3);
});

it('refuses an accept when the suggested time changed after it was read, and changes nothing', async () => {
  const THU_11 = '2026-11-26T09:00:00.000Z';
  const asked = await book(student, TUE_10);
  await propose(expert, asked.body.id, THU_10);
  // Another suggestion lands after the route has checked the time and before its write.
  const realQuery = pool.query.bind(pool);
  let changed = false;
  const spy = jest.spyOn(pool, 'query').mockImplementation(async (text, params) => {
    if (!changed && /UPDATE bookings SET slot/.test(text)) {
      changed = true;
      await realQuery('UPDATE bookings SET proposed_slot = $2 WHERE id = $1', [asked.body.id, THU_11]);
    }
    return realQuery(text, params);
  });
  const res = await answer(student, asked.body.id, 'accept');
  spy.mockRestore();
  expect(changed).toBe(true);
  expect({ status: res.status, error: res.body.error }).toEqual({
    status: 409, error: 'That suggestion was just changed. Reload and look again.',
  });
  expect(await row(asked.body.id)).toMatchObject({ status: 'requested' });
  expect(new Date((await row(asked.body.id)).slot)).toEqual(new Date(TUE_10));
  expect((await row(asked.body.id)).proposed_slot).toEqual(new Date(THU_11));
});

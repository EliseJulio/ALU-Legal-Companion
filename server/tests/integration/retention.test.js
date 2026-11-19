import { q } from '../../src/db.js';
import { purgeExpired } from '../../src/services/retention.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

// A fixed clock so the 90-day line is exact.
const NOW = new Date('2026-11-18T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(NOW.getTime() - days * DAY);
const ahead = (hours) => new Date(NOW.getTime() + hours * 60 * 60 * 1000);

let expert;
let student;
let provider;
beforeEach(async () => {
  await resetDb();
  expert = (await makeUser('legal_expert', 'retention-expert@example.org')).user;
  student = (await makeUser('student', 'retention-student@alustudent.com')).user;
  provider = await makeProvider();
});

// An anonymous question has an anon_token and no user. An answered one has a time of answer.
const anonQuestion = ({ token, createdAt = ago(1), answeredAt = null }) => q(
  `INSERT INTO questions (anon_token, text, status, answer, answered_by, answered_at, created_at)
   VALUES ($1, 'A question', $2, $3, $4, $5, $6) RETURNING id`,
  [token, answeredAt ? 'answered' : 'open', answeredAt ? 'An answer' : null,
    answeredAt ? expert.id : null, answeredAt, createdAt]);

// Answered before the time of answer was recorded, so answered_at is empty.
const legacyAnswered = ({ token, createdAt }) => q(
  `INSERT INTO questions (anon_token, text, status, answer, answered_by, answered_at, created_at)
   VALUES ($1, 'An old question', 'answered', 'An answer', $2, NULL, $3) RETURNING id`,
  [token, expert.id, createdAt]);

const signedInQuestion = ({ answeredAt }) => q(
  `INSERT INTO questions (user_id, text, status, answer, answered_by, answered_at)
   VALUES ($1, 'My question', 'answered', 'An answer', $2, $3) RETURNING id`,
  [student.id, expert.id, answeredAt]);

const anonBooking = ({ token, slot, status = 'requested' }) => q(
  `INSERT INTO bookings (anon_token, provider_id, slot, status) VALUES ($1,$2,$3,$4) RETURNING id`,
  [token, provider.id, slot, status]);

const signedInBooking = ({ slot, status = 'completed' }) => q(
  `INSERT INTO bookings (user_id, provider_id, slot, status) VALUES ($1,$2,$3,$4) RETURNING id`,
  [student.id, provider.id, slot, status]);

const questionIds = async () => (await q('SELECT id FROM questions ORDER BY id')).map((r) => r.id);
const bookingIds = async () => (await q('SELECT id FROM bookings ORDER BY id')).map((r) => r.id);

describe('purgeExpired: anonymous questions', () => {
  it('deletes an anonymous question answered more than 90 days ago and keeps a recent one', async () => {
    const [old] = await anonQuestion({ token: 'old-answered', answeredAt: ago(91) });
    const [recent] = await anonQuestion({ token: 'recent-answered', answeredAt: ago(10) });
    expect((await purgeExpired(NOW)).questions).toBe(1);
    expect(await questionIds()).toEqual([recent.id]);
    expect(await questionIds()).not.toContain(old.id);
  });

  it('keeps an anonymous question with no answer, however old, and one answered exactly 90 days ago', async () => {
    const [waiting] = await anonQuestion({ token: 'old-waiting', createdAt: ago(400) });
    const [edge] = await anonQuestion({ token: 'edge-answered', answeredAt: ago(90) });
    expect((await purgeExpired(NOW)).questions).toBe(0);
    expect(await questionIds()).toEqual([waiting.id, edge.id]);
  });

  it('deletes an old answered question that has no time of answer, by its creation date', async () => {
    const [old] = await legacyAnswered({ token: 'legacy-old', createdAt: ago(120) });
    const [recent] = await legacyAnswered({ token: 'legacy-recent', createdAt: ago(10) });
    expect((await purgeExpired(NOW)).questions).toBe(1);
    expect(await questionIds()).toEqual([recent.id]);
    expect(await questionIds()).not.toContain(old.id);
  });
});

describe('purgeExpired: anonymous bookings', () => {
  it('deletes anonymous bookings more than 90 days past whatever their status and keeps the rest', async () => {
    await anonBooking({ token: 'b-requested', slot: ago(120), status: 'requested' });
    await anonBooking({ token: 'b-completed', slot: ago(95), status: 'completed' });
    const [edge] = await anonBooking({ token: 'b-edge', slot: ago(90), status: 'completed' });
    const [soon] = await anonBooking({ token: 'b-soon', slot: ahead(48) });
    expect(await purgeExpired(NOW)).toEqual({ questions: 0, bookings: 2 });
    expect(await bookingIds()).toEqual([edge.id, soon.id]);
  });
});

describe('purgeExpired: signed-in records', () => {
  it('never deletes a signed-in question or booking, however old', async () => {
    const [question] = await signedInQuestion({ answeredAt: ago(400) });
    const [booking] = await signedInBooking({ slot: ago(400) });
    expect(await purgeExpired(NOW)).toEqual({ questions: 0, bookings: 0 });
    expect(await questionIds()).toContain(question.id);
    expect(await bookingIds()).toContain(booking.id);
  });
});

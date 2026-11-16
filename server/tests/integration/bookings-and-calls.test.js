import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { hashAnonToken } from '../../src/services/anonToken.js';
import { verifyTicket, roomNameFor } from '../../src/services/callTickets.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

const MEET = 'https://meet.google.com/aaa-bbbb-ccc';
const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
const KEYS = ['CALL_TICKET_SECRET', 'CALL_SIGNAL_URL', 'DAILY_API_KEY', 'DAILY_DOMAIN'];
const saved = {};

let expert;
let student;
let otherStudent;
let provider;
beforeAll(() => { KEYS.forEach((k) => { saved[k] = process.env[k]; }); });
afterAll(() => { KEYS.forEach((k) => { process.env[k] = saved[k] ?? ''; }); });
beforeEach(async () => {
  process.env.CALL_TICKET_SECRET = 'test-secret-for-tickets-only-0123456789';
  process.env.CALL_SIGNAL_URL = 'wss://signal.example.invalid';
  process.env.DAILY_API_KEY = '';
  process.env.DAILY_DOMAIN = '';
  await resetDb();
  expert = await makeUser('legal_expert');
  student = await makeUser('student');
  otherStudent = await makeUser('student', 'other.student@alustudent.com');
  provider = await makeProvider(
    { name: 'Bookable Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', user_id: expert.user.id, bookable: true, meet_link: MEET },
    { verifiedBy: expert.user.id });
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const details = (overrides = {}) => ({ provider_id: provider.id, slot: inDays(3), topic: 'My landlord kept my deposit', ...overrides });
const book = (who, body = details()) => as(who, 'post', '/api/bookings').send(body);
const bookAnon = (body = details()) => request(app).post('/api/bookings/anonymous').send(body);
const accept = (id) => as(expert, 'post', `/api/bookings/${id}/status`).send({ status: 'accepted' });
const join = (who, id, body = {}) => as(who, 'post', `/api/bookings/${id}/join`).send(body);

describe('booking a consultation', () => {
  it('lets a student book a lawyer, and returns no account id', async () => {
    const res = await book(student);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ provider_id: provider.id, status: 'requested' });
    expect(res.body).not.toHaveProperty('user_id');
  });

  it('is for a signed-in student or staff member only', async () => {
    expect((await request(app).post('/api/bookings').send(details())).status).toBe(401);
    expect((await book(expert)).status).toBe(403);
  });

  it('lets a visitor book without a name, with a code that is kept only as a hash', async () => {
    const res = await bookAnon();
    expect(res.status).toBe(201);
    const [row] = await q('SELECT user_id, anon_token FROM bookings');
    expect(row).toEqual({ user_id: null, anon_token: hashAnonToken(res.body.anon_token) });
  });

  it('refuses a time that is in the past', async () => {
    expect((await book(student, details({ slot: inDays(-1) }))).status).toBe(400);
  });

  it('refuses a lawyer who does not take bookings or has not been checked', async () => {
    const walkIn = await makeProvider({ name: 'Walk In Office' }, { verifiedBy: expert.user.id });
    const another = await makeUser('legal_expert', 'another.expert@example.org');
    const unchecked = await makeProvider({ name: 'Unchecked Lawyer', user_id: another.user.id, bookable: true, meet_link: MEET });
    expect((await book(student, details({ provider_id: walkIn.id }))).status).toBe(400);
    expect((await book(student, details({ provider_id: unchecked.id }))).status).toBe(400);
  });
});

describe('joining the call', () => {
  const acceptedBooking = async () => {
    const created = await book(student);
    await accept(created.body.id);
    return created.body.id;
  };

  it('gives the lawyer a host ticket and the student a guest ticket for the same room', async () => {
    const id = await acceptedBooking();
    const lawyer = await join(expert, id);
    const guest = await join(student, id);
    expect(lawyer.body.room).toBe(roomNameFor(id));
    expect(guest.body.room).toBe(lawyer.body.room);
    expect(verifyTicket(lawyer.body.ticket).role).toBe('host');
    expect(verifyTicket(guest.body.ticket).role).toBe('guest');
  });

  it('lets an anonymous booker join with the code, and the ticket names no one', async () => {
    const created = await bookAnon();
    await accept(created.body.id);
    const res = await request(app).post(`/api/bookings/${created.body.id}/join`).send({ anon_token: created.body.anon_token });
    expect(res.status).toBe(200);
    expect(Object.keys(verifyTicket(res.body.ticket)).sort()).toEqual(['audio', 'exp', 'iat', 'role', 'room']);
  });

  it('gives no call for a booking that has not been accepted', async () => {
    const created = await book(student);
    const res = await join(student, created.body.id);
    expect(res.status).toBe(409);
    expect(res.body).not.toHaveProperty('ticket');
  });

  it('answers 404 to a different student', async () => {
    expect((await join(otherStudent, await acceptedBooking())).status).toBe(404);
  });

  it('falls back to the lawyer’s Meet link when calls inside the platform are not set up', async () => {
    process.env.CALL_SIGNAL_URL = '';
    const res = await join(student, await acceptedBooking());
    expect(res.body).toMatchObject({ provider: 'meet', url: MEET });
    expect(res.body).not.toHaveProperty('ticket');
  });
});

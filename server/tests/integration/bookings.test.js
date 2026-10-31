import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { makeAnonToken, hashAnonToken } from '../../src/services/anonToken.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

const ROOM = 'https://meet.google.com/aaa-bbbb-ccc';
const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

let expert;
let otherExpert;
let student;
let staff;
let admin;
let provider; // published, bookable, linked to `expert`
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
  expert = await makeUser('legal_expert');
  otherExpert = await makeUser('legal_expert', 'other.expert@example.org');
  student = await makeUser('student');
  staff = await makeUser('staff');
  provider = await makeProvider(
    { name: 'Bookable Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', user_id: expert.user.id, bookable: true, meet_link: ROOM },
    { verifiedBy: expert.user.id });
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const book = (who, body) => as(who, 'post', '/api/bookings').send(body);
const bookAnon = (body) => request(app).post('/api/bookings/anonymous').send(body);
const request1 = (overrides = {}) => ({ provider_id: provider.id, slot: inDays(3), topic: 'My landlord kept my deposit', ...overrides });
const setStatus = (who, id, status) => as(who, 'post', `/api/bookings/${id}/status`).send({ status });

describe('POST /api/bookings (signed in)', () => {
  it('lets a student and a staff member book', async () => {
    const one = await book(student, request1());
    expect(one.status).toBe(201);
    expect(one.body).toMatchObject({ provider_id: provider.id, status: 'requested', topic: 'My landlord kept my deposit' });
    expect((await book(staff, request1({ slot: inDays(4) }))).status).toBe(201);
  });

  it('stores the account and returns no account id', async () => {
    const res = await book(student, request1());
    expect(res.body).not.toHaveProperty('user_id');
    expect(res.body).not.toHaveProperty('anon_token');
    const [row] = await q('SELECT user_id, anon_token FROM bookings');
    expect(row).toEqual({ user_id: student.user.id, anon_token: null });
  });

  it('needs a student or staff login', async () => {
    expect((await request(app).post('/api/bookings').send(request1())).status).toBe(401);
    expect((await book(expert, request1())).status).toBe(403);
    expect((await book(admin, request1())).status).toBe(403);
  });

  it('refuses a request with missing fields', async () => {
    expect((await book(student, { slot: inDays(3) })).status).toBe(400);
    expect((await book(student, { provider_id: provider.id })).status).toBe(400);
  });

  it('refuses a provider id that is not a valid id', async () => {
    for (const bad of ['abc', -1, 0, 1.5, 2147483648, {}]) {
      const res = await book(student, request1({ provider_id: bad }));
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/provider_id/);
    }
  });

  it('refuses a provider that does not exist or is not bookable', async () => {
    const notBookable = await makeProvider({ name: 'Walk In Office' }, { verifiedBy: expert.user.id });
    const missing = await book(student, request1({ provider_id: 99999 }));
    expect(missing.status).toBe(400);
    expect(missing.body.error).toMatch(/does not take online bookings/);
    expect((await book(student, request1({ provider_id: notBookable.id }))).status).toBe(400);
  });

  it('refuses a bookable provider that nobody has verified', async () => {
    const unchecked = await makeProvider(
      { name: 'Unchecked Lawyer', user_id: otherExpert.user.id, bookable: true, meet_link: ROOM });
    const res = await book(student, request1({ provider_id: unchecked.id }));
    expect(res.status).toBe(400);
  });

  it('refuses a slot that is not a future date and time', async () => {
    for (const bad of ['tomorrow', '', 12345, inDays(-1), new Date().toISOString(), inDays(400)]) {
      const res = await book(student, request1({ slot: bad }));
      expect(res.status).toBe(400);
    }
  });

  it('refuses a topic that is too long or not text', async () => {
    expect((await book(student, request1({ topic: 'x'.repeat(501) }))).status).toBe(400);
    expect((await book(student, request1({ topic: 42 }))).status).toBe(400);
    expect((await book(student, request1({ topic: 'x'.repeat(500) }))).status).toBe(201);
  });

  it('accepts a booking with no topic', async () => {
    const res = await book(student, request1({ topic: undefined }));
    expect(res.status).toBe(201);
    expect(res.body.topic).toBeNull();
  });
});

describe('POST /api/bookings/anonymous', () => {
  it('stores no identity and returns a token once with a warning', async () => {
    const res = await bookAnon(request1());
    expect(res.status).toBe(201);
    expect(res.body.anon_token).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(res.body.warning).toMatch(/shown only once and cannot be recovered/);
    expect(res.body).not.toHaveProperty('user_id');
    const [row] = await q('SELECT user_id, anon_token FROM bookings');
    expect(row).toEqual({ user_id: null, anon_token: hashAnonToken(res.body.anon_token) });
  });

  it('keeps only a hash of the token in the database', async () => {
    const { body } = await bookAnon(request1());
    const [row] = await q('SELECT anon_token FROM bookings');
    expect(row.anon_token).toMatch(/^[0-9a-f]{64}$/);
    expect(row.anon_token).not.toBe(body.anon_token);
    expect(row.anon_token).not.toContain(body.anon_token.slice(0, 4));
  });

  it('stays anonymous even when the caller is signed in', async () => {
    const res = await request(app).post('/api/bookings/anonymous')
      .set('Authorization', student.auth).send(request1());
    expect(res.status).toBe(201);
    const [row] = await q('SELECT user_id FROM bookings');
    expect(row.user_id).toBeNull();
  });

  it('gives a different token each time', async () => {
    const tokens = new Set();
    for (let i = 0; i < 200; i += 1) tokens.add(makeAnonToken());
    expect(tokens.size).toBe(200);
  });

  it('applies the same checks as a signed-in booking', async () => {
    expect((await bookAnon({ slot: inDays(3) })).status).toBe(400);
    expect((await bookAnon(request1({ provider_id: 99999 }))).status).toBe(400);
    expect((await bookAnon(request1({ slot: inDays(-2) }))).status).toBe(400);
  });
});

describe('GET /api/bookings/anon/:token', () => {
  it('finds a booking by its token without a login', async () => {
    const { body } = await bookAnon(request1());
    const res = await request(app).get(`/api/bookings/anon/${body.anon_token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'requested', provider_name: 'Bookable Lawyer', topic: 'My landlord kept my deposit' });
    expect(res.body).not.toHaveProperty('user_id');
    expect(res.body).not.toHaveProperty('anon_token');
  });

  it('accepts the token in lower case with spaces around it', async () => {
    const { body } = await bookAnon(request1());
    const res = await request(app).get(`/api/bookings/anon/%20${body.anon_token.toLowerCase()}%20`);
    expect(res.status).toBe(200);
  });

  it('accepts the token without hyphens and with look-alike letters', async () => {
    await q(`INSERT INTO bookings (anon_token, provider_id, slot) VALUES ($1, $2, now())`,
      [hashAnonToken('K7F2-9QMD-31XZ-84H0'), provider.id]);
    for (const typed of ['K7F29QMD31XZ84H0', 'k7f2-9qmd-3lxz-84ho', 'K7F2%209QMD%2031XZ%2084H0']) {
      const res = await request(app).get(`/api/bookings/anon/${typed}`);
      expect(res.status).toBe(200);
    }
  });

  it('answers 404 for text that cannot be a token without asking the database', async () => {
    for (const bad of ['short', 'K7F2-9QMD-31XZ-84HU', 'AAAA-BBBB-CCCC']) {
      const res = await request(app).get(`/api/bookings/anon/${bad}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No booking found/);
    }
  });

  it('answers 404 for an unknown token', async () => {
    const res = await request(app).get('/api/bookings/anon/K7F2-9QMD-31XZ-84H0');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No booking found/);
  });
});

describe('GET /api/bookings/mine', () => {
  it('shows only my own bookings and sorts the latest slot first', async () => {
    await book(student, request1({ slot: inDays(2), topic: 'first' }));
    await book(student, request1({ slot: inDays(9), topic: 'second' }));
    await book(staff, request1({ slot: inDays(5), topic: 'not mine' }));
    const res = await as(student, 'get', '/api/bookings/mine');
    expect(res.status).toBe(200);
    expect(res.body.map((b) => b.topic)).toEqual(['second', 'first']);
    expect(res.body[0].provider_name).toBe('Bookable Lawyer');
    expect(res.body[0]).not.toHaveProperty('user_id');
  });

  it('needs a student or staff login', async () => {
    expect((await request(app).get('/api/bookings/mine')).status).toBe(401);
    expect((await as(expert, 'get', '/api/bookings/mine')).status).toBe(403);
  });
});

describe('GET /api/bookings/expert', () => {
  it('shows only the bookings for the entry linked to this expert', async () => {
    const other = await makeProvider(
      { name: 'Other Lawyer', user_id: otherExpert.user.id, bookable: true, meet_link: ROOM },
      { verifiedBy: expert.user.id });
    await book(student, request1({ topic: 'for me' }));
    await book(student, request1({ provider_id: other.id, topic: 'for the other expert', slot: inDays(4) }));
    const mine = await as(expert, 'get', '/api/bookings/expert');
    expect(mine.body.map((b) => b.topic)).toEqual(['for me']);
    const theirs = await as(otherExpert, 'get', '/api/bookings/expert');
    expect(theirs.body.map((b) => b.topic)).toEqual(['for the other expert']);
  });

  it('shows a name for a signed-in requester and only "Anonymous" for an anonymous one', async () => {
    await book(student, request1({ slot: inDays(2) }));
    const anon = await bookAnon(request1({ slot: inDays(3) }));
    const rows = (await as(expert, 'get', '/api/bookings/expert')).body;
    expect(rows.map((b) => b.requester)).toEqual(['Test student', 'Anonymous']);
    expect(JSON.stringify(rows)).not.toContain(anon.body.anon_token.slice(0, 4));
  });

  it('is for legal experts only', async () => {
    expect((await request(app).get('/api/bookings/expert')).status).toBe(401);
    expect((await as(student, 'get', '/api/bookings/expert')).status).toBe(403);
    expect((await as(admin, 'get', '/api/bookings/expert')).status).toBe(403);
  });
});

describe('the video room', () => {
  it('is given out only after the booking is accepted, on all three reads', async () => {
    const mine = await book(student, request1());
    const anon = await bookAnon(request1({ slot: inDays(4) }));
    const readAll = async () => ({
      mine: (await as(student, 'get', '/api/bookings/mine')).body[0].meet_link,
      anon: (await request(app).get(`/api/bookings/anon/${anon.body.anon_token}`)).body.meet_link,
      expert: (await as(expert, 'get', '/api/bookings/expert')).body.map((b) => b.meet_link),
    });

    expect(await readAll()).toEqual({ mine: null, anon: null, expert: [null, null] });

    await setStatus(expert, mine.body.id, 'accepted');
    await setStatus(expert, anon.body.id, 'accepted');
    expect(await readAll()).toEqual({ mine: ROOM, anon: ROOM, expert: [ROOM, ROOM] });
  });

  it('is taken back when the booking is declined or completed', async () => {
    const a = await book(student, request1({ slot: inDays(2) }));
    const b = await book(student, request1({ slot: inDays(3) }));
    await setStatus(expert, a.body.id, 'declined');
    await setStatus(expert, b.body.id, 'accepted');
    await setStatus(expert, b.body.id, 'completed');
    const rows = (await as(student, 'get', '/api/bookings/mine')).body;
    expect(rows.every((r) => r.meet_link === null)).toBe(true);
  });

  it('is null for an accepted booking when the expert has no room yet', async () => {
    await q('UPDATE providers SET meet_link = NULL WHERE id = $1', [provider.id]);
    const created = await book(student, request1());
    await setStatus(expert, created.body.id, 'accepted');
    const [row] = (await as(student, 'get', '/api/bookings/mine')).body;
    expect(row.status).toBe('accepted');
    expect(row.meet_link).toBeNull();
  });
});

describe('POST /api/bookings/:id/status', () => {
  it('lets the expert accept and then complete a booking', async () => {
    const created = await book(student, request1());
    const accepted = await setStatus(expert, created.body.id, 'accepted');
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('accepted');
    expect((await setStatus(expert, created.body.id, 'completed')).body.status).toBe('completed');
  });

  it('lets the expert decline a request and cancel an accepted booking', async () => {
    const a = await book(student, request1({ slot: inDays(2) }));
    const b = await book(student, request1({ slot: inDays(3) }));
    await setStatus(expert, b.body.id, 'accepted');
    expect((await setStatus(expert, a.body.id, 'declined')).body.status).toBe('declined');
    expect((await setStatus(expert, b.body.id, 'declined')).body.status).toBe('declined');
  });

  it('only moves a booking forward', async () => {
    const created = await book(student, request1());
    const tooSoon = await setStatus(expert, created.body.id, 'completed');
    expect(tooSoon.status).toBe(400);
    expect(tooSoon.body.error).toMatch(/requested cannot be marked completed/);

    await setStatus(expert, created.body.id, 'declined');
    const back = await setStatus(expert, created.body.id, 'accepted');
    expect(back.status).toBe(400);
    expect(back.body.error).toMatch(/declined cannot be marked accepted/);
  });

  it('refuses a status that is not one of the three', async () => {
    const created = await book(student, request1());
    for (const bad of ['requested', 'cancelled', '', undefined, 5]) {
      const res = await setStatus(expert, created.body.id, bad);
      expect(res.status).toBe(400);
    }
  });

  it('answers 404 for another expert’s booking and an unknown booking', async () => {
    const created = await book(student, request1());
    expect((await setStatus(otherExpert, created.body.id, 'accepted')).status).toBe(404);
    expect((await setStatus(expert, 99999, 'accepted')).status).toBe(404);
    expect((await setStatus(expert, 'abc', 'accepted')).status).toBe(404);
    const [row] = await q('SELECT status FROM bookings WHERE id = $1', [created.body.id]);
    expect(row.status).toBe('requested');
  });

  it('is for legal experts only', async () => {
    const created = await book(student, request1());
    expect((await request(app).post(`/api/bookings/${created.body.id}/status`).send({ status: 'accepted' })).status).toBe(401);
    expect((await setStatus(student, created.body.id, 'accepted')).status).toBe(403);
    expect((await setStatus(admin, created.body.id, 'accepted')).status).toBe(403);
  });

  it('does not accept two bookings for the same time', async () => {
    const slot = inDays(5);
    const first = await book(student, request1({ slot }));
    const second = await book(staff, request1({ slot }));
    expect((await setStatus(expert, first.body.id, 'accepted')).status).toBe(200);
    const clash = await setStatus(expert, second.body.id, 'accepted');
    expect(clash.status).toBe(409);
    expect(clash.body.error).toMatch(/already have an accepted booking at that time/);
    const [row] = await q('SELECT status FROM bookings WHERE id = $1', [second.body.id]);
    expect(row.status).toBe('requested');
  });

  it('lets the same time be accepted again after the first one is declined', async () => {
    const slot = inDays(5);
    const first = await book(student, request1({ slot }));
    const second = await book(staff, request1({ slot }));
    await setStatus(expert, first.body.id, 'accepted');
    await setStatus(expert, first.body.id, 'declined');
    expect((await setStatus(expert, second.body.id, 'accepted')).status).toBe(200);
  });

  it('lets only one of two simultaneous accepts for the same time succeed', async () => {
    const slot = inDays(6);
    const first = await book(student, request1({ slot }));
    const second = await book(staff, request1({ slot }));
    const results = await Promise.all([
      setStatus(expert, first.body.id, 'accepted'),
      setStatus(expert, second.body.id, 'accepted'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
});

describe('the database rules for bookings', () => {
  it('refuses a booking with both an account and a token', async () => {
    await expect(q(
      `INSERT INTO bookings (user_id, anon_token, provider_id, slot) VALUES ($1,'AAAA-BBBB-CCCC',$2, now())`,
      [student.user.id, provider.id])).rejects.toThrow(/bookings_check/);
  });

  it('refuses a booking with neither', async () => {
    await expect(q('INSERT INTO bookings (provider_id, slot) VALUES ($1, now())', [provider.id]))
      .rejects.toThrow(/bookings_check/);
  });

  it('never stores the same token twice', async () => {
    await q(`INSERT INTO bookings (anon_token, provider_id, slot) VALUES ('AAAA-BBBB-CCCC',$1, now())`, [provider.id]);
    await expect(q(`INSERT INTO bookings (anon_token, provider_id, slot) VALUES ('AAAA-BBBB-CCCC',$1, now())`, [provider.id]))
      .rejects.toThrow(/bookings_anon_token_key/);
  });

  it('allows many signed-in bookings that have no token', async () => {
    await book(student, request1({ slot: inDays(2) }));
    await book(student, request1({ slot: inDays(3) }));
    const [{ n }] = await q('SELECT count(*)::int AS n FROM bookings');
    expect(n).toBe(2);
  });

  it('refuses a bookable provider with no expert account', async () => {
    await expect(makeProvider({ name: 'No Expert', bookable: true })).rejects.toThrow(/providers_bookable_needs_expert/);
  });
});

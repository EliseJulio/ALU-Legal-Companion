import request from 'supertest';
import app from '../../src/app.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

const ROOM = 'https://meet.google.com/aaa-bbbb-ccc';

let admin;
let expert;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
  expert = await makeUser('legal_expert');
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const NEW_ENTRY = {
  name: 'Test Pro-bono Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', location: 'Kigali',
};

describe('bookable entries and the video room', () => {
  it('creates a bookable entry with a room when an expert account is linked', async () => {
    const res = await as(admin, 'post', '/api/directory/providers')
      .send({ ...NEW_ENTRY, user_id: expert.user.id, bookable: true, meet_link: ROOM });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ bookable: true, meet_link: ROOM, status: 'draft' });
  });

  it('refuses a bookable entry that has no expert account', async () => {
    const res = await as(admin, 'post', '/api/directory/providers').send({ ...NEW_ENTRY, bookable: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Link a legal expert account/);
  });

  it('refuses to unlink the expert from an entry that takes bookings', async () => {
    const entry = await makeProvider({ user_id: expert.user.id, bookable: true, meet_link: ROOM });
    const res = await as(admin, 'put', `/api/directory/providers/${entry.id}`).send({ user_id: null });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Link a legal expert account/);
    const unbook = await as(admin, 'put', `/api/directory/providers/${entry.id}`).send({ user_id: null, bookable: false });
    expect(unbook.status).toBe(200);
  });

  it.each([
    ['an http address', 'http://meet.google.com/aaa-bbbb-ccc'],
    ['another site', 'https://example.org/room'],
    ['a look-alike site', 'https://meet.google.com.evil.example/aaa'],
    ['a script', 'javascript:alert(1)'],
    ['text that is not an address', 'my room'],
  ])('refuses %s as the room', async (_label, link) => {
    const res = await as(admin, 'post', '/api/directory/providers')
      .send({ ...NEW_ENTRY, user_id: expert.user.id, bookable: true, meet_link: link });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/meet_link/);
  });

  it('keeps a published entry published when only the booking settings change', async () => {
    const entry = await makeProvider({ user_id: expert.user.id }, { verifiedBy: expert.user.id });
    const res = await as(admin, 'put', `/api/directory/providers/${entry.id}`)
      .send({ bookable: true, meet_link: ROOM });
    expect(res.body).toMatchObject({ status: 'published', bookable: true, meet_link: ROOM });
    const cleared = await as(admin, 'put', `/api/directory/providers/${entry.id}`).send({ meet_link: null });
    expect(cleared.body).toMatchObject({ status: 'published', meet_link: null });
  });

  it('shows bookable entries first and never shows the room to the public', async () => {
    await makeProvider({ name: 'A Walk In Office' }, { verifiedBy: expert.user.id });
    await makeProvider({ name: 'Z Bookable Lawyer', user_id: expert.user.id, bookable: true, meet_link: ROOM }, { verifiedBy: expert.user.id });
    const rows = (await request(app).get('/api/directory/providers')).body;
    expect(rows.map((p) => [p.name, p.bookable])).toEqual([['Z Bookable Lawyer', true], ['A Walk In Office', false]]);
    expect(rows[0]).not.toHaveProperty('meet_link');
  });

  it('shows the room to the admin, and refuses the list to an expert', async () => {
    await makeProvider({ user_id: expert.user.id, bookable: true, meet_link: ROOM });
    const forAdmin = (await as(admin, 'get', '/api/directory/providers/all')).body[0];
    expect(forAdmin).toMatchObject({ bookable: true, meet_link: ROOM });
    expect((await as(expert, 'get', '/api/directory/providers/all')).status).toBe(403);
  });
});

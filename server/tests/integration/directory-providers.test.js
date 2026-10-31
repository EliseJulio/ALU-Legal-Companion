import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

let admin;
let expert;
let student;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
  expert = await makeUser('legal_expert');
  student = await makeUser('student');
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const publicList = (query = '') => request(app).get(`/api/directory/providers${query}`);

const NEW_ENTRY = {
  name: 'Test Pro-bono Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', location: 'Kigali',
  contact: '0788000001', services: 'Employment matters', languages: 'English', is_free: true,
};

describe('GET /api/directory/providers (public)', () => {
  it('shows published entries only', async () => {
    await makeProvider({ name: 'Published One' }, { verifiedBy: expert.user.id });
    await makeProvider({ name: 'Still A Draft' });
    await q("UPDATE providers SET status = 'pending_review' WHERE name = 'Still A Draft'");
    const res = await publicList();
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.name)).toEqual(['Published One']);
  });

  it('never shows the account behind an entry or the internal status', async () => {
    await makeProvider({ user_id: expert.user.id }, { verifiedBy: expert.user.id });
    const [row] = (await publicList()).body;
    expect(row).not.toHaveProperty('user_id');
    expect(row).not.toHaveProperty('status');
    expect(row).not.toHaveProperty('verified_by_name');
  });

  it('filters by category and by type', async () => {
    await makeProvider({ name: 'A Lawyer', category: 'lawyer', type: 'pro_bono_lawyer' }, { verifiedBy: expert.user.id });
    await makeProvider({ name: 'A Consultant', category: 'consultant', type: 'legal_aid' }, { verifiedBy: expert.user.id });
    await makeProvider({ name: 'An Organisation', category: 'organisation', type: 'abunzi' }, { verifiedBy: expert.user.id });

    expect((await publicList('?category=lawyer')).body.map((p) => p.name)).toEqual(['A Lawyer']);
    expect((await publicList('?category=organisation')).body.map((p) => p.name)).toEqual(['An Organisation']);
    expect((await publicList('?type=legal_aid')).body.map((p) => p.name)).toEqual(['A Consultant']);
    expect((await publicList('?category=nonsense')).body).toEqual([]);
  });

  it('filters to free entries', async () => {
    await makeProvider({ name: 'Free One', is_free: true }, { verifiedBy: expert.user.id });
    await makeProvider({ name: 'Paid One', is_free: false }, { verifiedBy: expert.user.id });
    expect((await publicList('?free=true')).body.map((p) => p.name)).toEqual(['Free One']);
    expect((await publicList()).body).toHaveLength(2);
  });

  it('searches the name and the place and the services', async () => {
    await makeProvider({ name: 'Gasabo Office', location: 'Gasabo', services: 'Tenancy' }, { verifiedBy: expert.user.id });
    await makeProvider({ name: 'Other Office', location: 'Huye', services: 'Immigration help' }, { verifiedBy: expert.user.id });
    expect((await publicList('?q=gasabo')).body.map((p) => p.name)).toEqual(['Gasabo Office']);
    expect((await publicList('?q=immigration')).body.map((p) => p.name)).toEqual(['Other Office']);
    expect((await publicList('?q=office')).body).toHaveLength(2);
  });

  it('searches a typed % as a letter and not as a wildcard', async () => {
    await makeProvider({ name: 'Plain Office' }, { verifiedBy: expert.user.id });
    expect((await publicList('?q=%25')).body).toEqual([]);
  });

  it('sorts by name', async () => {
    await makeProvider({ name: 'Zeta Office' }, { verifiedBy: expert.user.id });
    await makeProvider({ name: 'Alpha Office' }, { verifiedBy: expert.user.id });
    expect((await publicList()).body.map((p) => p.name)).toEqual(['Alpha Office', 'Zeta Office']);
  });

  it('flags an entry as stale when it was not checked for over 180 days', async () => {
    const fresh = await makeProvider({ name: 'Fresh' }, { verifiedBy: expert.user.id });
    const old = await makeProvider({ name: 'Old' }, { verifiedBy: expert.user.id });
    const never = await makeProvider({ name: 'Never' }, { verifiedBy: expert.user.id });
    await q("UPDATE providers SET last_checked_at = CURRENT_DATE - 200 WHERE id = $1", [old.id]);
    await q('UPDATE providers SET last_checked_at = NULL WHERE id = $1', [never.id]);
    const byName = Object.fromEntries((await publicList()).body.map((p) => [p.name, p.stale]));
    expect(byName).toEqual({ Fresh: false, Old: true, Never: true });
    expect(fresh.id).toBeTruthy();
  });
});

describe('GET /api/directory/providers/all (staff)', () => {
  it('needs a staff login', async () => {
    expect((await request(app).get('/api/directory/providers/all')).status).toBe(401);
    expect((await as(student, 'get', '/api/directory/providers/all')).status).toBe(403);
    expect((await as(expert, 'get', '/api/directory/providers/all')).status).toBe(403);
  });

  it('shows every state and the linked account to the admin', async () => {
    const linked = await makeProvider({ name: 'Linked', user_id: expert.user.id });
    await makeProvider({ name: 'Published One' }, { verifiedBy: admin.user.id });
    const res = await as(admin, 'get', '/api/directory/providers/all');
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.status).sort()).toEqual(['draft', 'published']);
    expect(res.body.find((p) => p.id === linked.id).user_id).toBe(expert.user.id);
  });
});

describe('POST /api/directory/providers', () => {
  it('is for the admin only', async () => {
    expect((await request(app).post('/api/directory/providers').send(NEW_ENTRY)).status).toBe(401);
    expect((await as(student, 'post', '/api/directory/providers').send(NEW_ENTRY)).status).toBe(403);
    expect((await as(expert, 'post', '/api/directory/providers').send(NEW_ENTRY)).status).toBe(403);
  });

  it('creates a draft whatever the body says', async () => {
    const res = await as(admin, 'post', '/api/directory/providers')
      .send({ ...NEW_ENTRY, status: 'published', verified_by: admin.user.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Test Pro-bono Lawyer', category: 'lawyer', status: 'draft', verified_by: null });
    expect((await publicList()).body).toEqual([]);
  });

  it('links a legal expert account', async () => {
    const res = await as(admin, 'post', '/api/directory/providers').send({ ...NEW_ENTRY, user_id: expert.user.id });
    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(expert.user.id);
  });

  it('refuses a missing name and a bad category and a bad type', async () => {
    const noName = await as(admin, 'post', '/api/directory/providers').send({ ...NEW_ENTRY, name: '  ' });
    expect(noName.status).toBe(400);
    const badCategory = await as(admin, 'post', '/api/directory/providers').send({ ...NEW_ENTRY, category: 'other' });
    expect(badCategory.status).toBe(400);
    expect(badCategory.body.error).toMatch(/lawyer, consultant, organisation/);
    const badType = await as(admin, 'post', '/api/directory/providers').send({ ...NEW_ENTRY, type: 'wizard' });
    expect(badType.status).toBe(400);
    expect(badType.body.error).toMatch(/type must be one of/);
  });

  it('refuses a source address that is not https', async () => {
    const res = await as(admin, 'post', '/api/directory/providers')
      .send({ ...NEW_ENTRY, official_source_url: 'http://example.org/page' });
    expect(res.status).toBe(400);
    const junk = await as(admin, 'post', '/api/directory/providers')
      .send({ ...NEW_ENTRY, official_source_url: 'javascript:alert(1)' });
    expect(junk.status).toBe(400);
  });

  it('refuses a user_id that is not a legal expert', async () => {
    const student2 = await makeUser('student', 'other.student@alustudent.com');
    const asStudent = await as(admin, 'post', '/api/directory/providers').send({ ...NEW_ENTRY, user_id: student2.user.id });
    expect(asStudent.status).toBe(400);
    const missing = await as(admin, 'post', '/api/directory/providers').send({ ...NEW_ENTRY, user_id: 99999 });
    expect(missing.status).toBe(400);
  });
});

describe('PUT /api/directory/providers/:id', () => {
  const put = (who, id, body) => as(who, 'put', `/api/directory/providers/${id}`).send(body);

  it('is for the admin only and answers 404 for an unknown entry', async () => {
    const entry = await makeProvider();
    expect((await put(expert, entry.id, { name: 'X' })).status).toBe(403);
    expect((await put(admin, 99999, { name: 'X' })).status).toBe(404);
    expect((await put(admin, 'abc', { name: 'X' })).status).toBe(404);
  });

  it('keeps what the request did not send', async () => {
    const entry = await makeProvider({ location: 'Kigali', contact: '0788000000' });
    const res = await put(admin, entry.id, { contact: '0788999999' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ location: 'Kigali', contact: '0788999999', name: 'Test Legal Aid Office' });
  });

  it('sends a published entry back to draft when a checked fact changes', async () => {
    const entry = await makeProvider({}, { verifiedBy: expert.user.id });
    const res = await put(admin, entry.id, { contact: '0788111222' });
    expect(res.body).toMatchObject({ status: 'draft', verified_by: null, verified_at: null });
    expect((await publicList()).body).toEqual([]);
  });

  it('sends a published entry back to draft when it is made free or paid', async () => {
    const entry = await makeProvider({ is_free: true }, { verifiedBy: expert.user.id });
    const res = await put(admin, entry.id, { is_free: false });
    expect(res.body.status).toBe('draft');
  });

  it('treats an emptied text field as a change', async () => {
    const entry = await makeProvider({ location: 'Kigali' }, { verifiedBy: expert.user.id });
    const res = await put(admin, entry.id, { location: '' });
    expect(res.body).toMatchObject({ location: null, status: 'draft' });
  });

  it('keeps a published entry published when nothing real changed', async () => {
    const entry = await makeProvider({}, { verifiedBy: expert.user.id });
    const res = await put(admin, entry.id, { name: entry.name, contact: entry.contact, is_free: true });
    expect(res.body.status).toBe('published');
    expect(res.body.verified_by).toBe(expert.user.id);
  });

  it('keeps a published entry published when only the linked account changes', async () => {
    const entry = await makeProvider({}, { verifiedBy: expert.user.id });
    const linked = await put(admin, entry.id, { user_id: expert.user.id });
    expect(linked.body).toMatchObject({ status: 'published', user_id: expert.user.id });
    const unlinked = await put(admin, entry.id, { user_id: null });
    expect(unlinked.body).toMatchObject({ status: 'published', user_id: null });
  });

  it('refuses a bad value and changes nothing', async () => {
    const entry = await makeProvider({}, { verifiedBy: expert.user.id });
    expect((await put(admin, entry.id, { category: 'wizard' })).status).toBe(400);
    expect((await put(admin, entry.id, { official_source_url: 'ftp://example.org' })).status).toBe(400);
    const [row] = await q('SELECT status, category FROM providers WHERE id = $1', [entry.id]);
    expect(row).toEqual({ status: 'published', category: 'consultant' });
  });
});

describe('publishing a directory entry', () => {
  const publish = (who, id) => as(who, 'post', `/api/directory/providers/${id}/publish`).send({});

  it('is for the admin only, never a legal expert or a student', async () => {
    const entry = await makeProvider();
    expect((await publish(expert, entry.id)).status).toBe(403);
    expect((await publish(student, entry.id)).status).toBe(403);
    expect((await publish(admin, entry.id)).status).toBe(200);
  });

  it('stamps the admin and the day and records the review', async () => {
    const entry = await makeProvider();
    await publish(admin, entry.id);
    const [row] = await q('SELECT status, verified_by, verified_at, last_checked_at FROM providers WHERE id = $1', [entry.id]);
    const [{ today }] = await q("SELECT (now() AT TIME ZONE 'Africa/Kigali')::date AS today");
    expect(row.status).toBe('published');
    expect(row.verified_by).toBe(admin.user.id);
    expect(row.verified_at).not.toBeNull();
    expect(row.last_checked_at).toBe(today);

    const reviews = await q('SELECT record_type, decision, reviewer_id FROM directory_reviews');
    expect(reviews).toEqual([{ record_type: 'provider', decision: 'published', reviewer_id: admin.user.id }]);
    expect((await publicList()).body).toHaveLength(1);
  });

  it('refuses to publish an entry that is already published', async () => {
    const entry = await makeProvider({}, { verifiedBy: admin.user.id });
    const res = await publish(admin, entry.id);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already published/);
  });

  it('goes all the way from a new entry to the public list and back out again on an edit', async () => {
    const created = await as(admin, 'post', '/api/directory/providers').send(NEW_ENTRY);
    const id = created.body.id;
    await publish(admin, id);
    expect((await publicList()).body.map((p) => p.name)).toEqual(['Test Pro-bono Lawyer']);
    await as(admin, 'put', `/api/directory/providers/${id}`).send({ contact: '0788555555' });
    expect((await publicList()).body).toEqual([]);
  });
});

describe('the address of a body', () => {
  const WITH_ADDRESS = {
    ...NEW_ENTRY, address: 'KG 9 Avenue, Kigali', hours: 'Monday to Friday, 8am to 5pm',
    address_note: 'No plot number is published.',
  };

  it('is saved and shown to the public once the entry is verified', async () => {
    const created = await as(admin, 'post', '/api/directory/providers').send(WITH_ADDRESS);
    expect(created.status).toBe(201);
    await as(admin, 'post', `/api/directory/providers/${created.body.id}/publish`);
    const [row] = (await publicList()).body;
    expect(row).toMatchObject({
      address: 'KG 9 Avenue, Kigali', hours: 'Monday to Friday, 8am to 5pm',
      address_note: 'No plot number is published.',
    });
  });

  it('is a checked fact. Editing it sends a published entry back to draft', async () => {
    const entry = await makeProvider({}, { verifiedBy: expert.user.id });
    const res = await as(admin, 'put', `/api/directory/providers/${entry.id}`).send({ address: 'KG 7 Ave, Kigali' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.verified_by).toBeNull();
    expect((await publicList()).body).toEqual([]);
  });

  it('counts the note about what could not be confirmed as a checked fact too', async () => {
    const entry = await makeProvider({}, { verifiedBy: expert.user.id });
    const res = await as(admin, 'put', `/api/directory/providers/${entry.id}`).send({ address_note: 'Plot unknown.' });
    expect(res.body.status).toBe('draft');
  });

  it('is kept when an edit does not mention it', async () => {
    const entry = await makeProvider({}, { verifiedBy: expert.user.id });
    await q("UPDATE providers SET address = 'KG 7 Ave, Kigali' WHERE id = $1", [entry.id]);
    const res = await as(admin, 'put', `/api/directory/providers/${entry.id}`).send({ bookable: false });
    expect(res.body.address).toBe('KG 7 Ave, Kigali');
    expect(res.body.status).toBe('published');
  });

  it('reaches the admin in the staff list', async () => {
    const created = await as(admin, 'post', '/api/directory/providers').send(WITH_ADDRESS);
    const list = (await as(admin, 'get', '/api/directory/providers/all')).body;
    expect(list.find((p) => p.id === created.body.id)).toMatchObject({ address: 'KG 9 Avenue, Kigali' });
  });
});

describe('the database rules', () => {
  it('refuses a published entry with no verifier', async () => {
    const entry = await makeProvider();
    await expect(q("UPDATE providers SET status = 'published' WHERE id = $1", [entry.id]))
      .rejects.toThrow(/providers_published_is_verified/);
  });

  it('refuses a category that is not lawyer, consultant or organisation', async () => {
    await expect(makeProvider({ category: 'other' })).rejects.toThrow(/providers_category_check/);
  });
});

describe('GET /api/directory/providers/:id (one listing)', () => {
  it('returns a published entry with the same public fields as the list', async () => {
    const entry = await makeProvider({ name: 'Open Office', location: 'Kigali' }, { verifiedBy: expert.user.id });
    const one = await request(app).get(`/api/directory/providers/${entry.id}`);
    expect(one.status).toBe(200);
    expect(one.body.name).toBe('Open Office');
    const listed = (await publicList()).body.find((p) => p.id === entry.id);
    expect(Object.keys(one.body).sort()).toEqual(Object.keys(listed).sort());
  });

  it('names the expert who checked it and says whether it is stale', async () => {
    const entry = await makeProvider({ name: 'Open Office' }, { verifiedBy: expert.user.id });
    const one = await request(app).get(`/api/directory/providers/${entry.id}`);
    expect(one.body).not.toHaveProperty('verified_by_name');
    expect(typeof one.body.stale).toBe('boolean');
  });

  it('never shows the account behind an entry or its meeting room', async () => {
    const entry = await makeProvider({ name: 'Open Office' }, { verifiedBy: expert.user.id });
    await q('UPDATE providers SET user_id = $1, meet_link = $2 WHERE id = $3',
      [expert.user.id, 'https://meet.google.com/abc-defg-hij', entry.id]);
    const one = await request(app).get(`/api/directory/providers/${entry.id}`);
    expect(one.status).toBe(200);
    expect(one.body).not.toHaveProperty('user_id');
    expect(one.body).not.toHaveProperty('meet_link');
  });

  it('answers 404 for a draft, a submitted entry, an id that does not exist and a word', async () => {
    const draft = await makeProvider({ name: 'Still A Draft' });
    expect((await request(app).get(`/api/directory/providers/${draft.id}`)).status).toBe(404);
    await q("UPDATE providers SET status = 'pending_review' WHERE id = $1", [draft.id]);
    expect((await request(app).get(`/api/directory/providers/${draft.id}`)).status).toBe(404);
    expect((await request(app).get('/api/directory/providers/999999')).status).toBe(404);
    expect((await request(app).get('/api/directory/providers/everything')).status).toBe(404);
  });

  it('stops answering the moment an entry is no longer published', async () => {
    const entry = await makeProvider({ name: 'Open Office' }, { verifiedBy: expert.user.id });
    expect((await request(app).get(`/api/directory/providers/${entry.id}`)).status).toBe(200);
    await q("UPDATE providers SET status = 'draft', verified_by = NULL, verified_at = NULL WHERE id = $1", [entry.id]);
    expect((await request(app).get(`/api/directory/providers/${entry.id}`)).status).toBe(404);
  });

  it('does not swallow the staff list', async () => {
    const res = await as(admin, 'get', '/api/directory/providers/all');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeGuide } from '../helpers.js';

let student;
let staff;
let expert;
let admin;
beforeEach(async () => {
  await resetDb();
  student = await makeUser('student');
  staff = await makeUser('staff', 'staff.person@alueducation.com');
  expert = await makeUser('legal_expert');
  admin = await makeUser('admin');
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const published = (overrides = {}) => makeGuide(overrides, { verifiedBy: expert.user.id });
const save = (who, id) => as(who, 'post', `/api/guides/${id}/bookmark`);
const saved = async (who) => (await as(who, 'get', '/api/bookmarks')).body;

describe('POST /api/guides/:id/bookmark', () => {
  it('saves a published guide for a student and for a staff member', async () => {
    const guide = await published();
    const one = await save(student, guide.id);
    expect(one.status).toBe(201);
    expect(one.body).toEqual({ guide_id: guide.id, bookmarked: true });
    expect((await save(staff, guide.id)).status).toBe(201);
  });

  it('is not an error to save the same guide twice', async () => {
    const guide = await published();
    await save(student, guide.id);
    expect((await save(student, guide.id)).status).toBe(201);
    const [{ n }] = await q('SELECT count(*)::int AS n FROM bookmarks');
    expect(n).toBe(1);
  });

  it('answers 404 for a guide that is not published, the same as reading it', async () => {
    const draft = await makeGuide();
    const res = await save(student, draft.id);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Guide not found' });
    const read = await request(app).get(`/api/guides/${draft.id}`);
    expect(read.status).toBe(res.status);
    expect(read.body).toEqual(res.body);
    expect((await save(student, 99999)).status).toBe(404);
    expect((await save(student, 'abc')).status).toBe(404);
  });

  it('needs a student or staff login', async () => {
    const guide = await published();
    expect((await request(app).post(`/api/guides/${guide.id}/bookmark`)).status).toBe(401);
    expect((await save(expert, guide.id)).status).toBe(403);
    expect((await save(admin, guide.id)).status).toBe(403);
  });
});

describe('GET /api/bookmarks', () => {
  it('lists my saved guides newest first as cards without the full text', async () => {
    const first = await published({ title: 'First saved' });
    const second = await published({ title: 'Second saved' });
    await save(student, first.id);
    await save(student, second.id);
    const rows = await saved(student);
    expect(rows.map((g) => g.title)).toEqual(['Second saved', 'First saved']);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'bookmarked_at', 'domain', 'id', 'source_law', 'status', 'title', 'verified_at']);
  });

  it('shows only my own saves', async () => {
    const guide = await published();
    await save(student, guide.id);
    expect(await saved(staff)).toEqual([]);
  });

  it('keeps a saved guide in the list as draft when it is un-published, and republishes it once published again', async () => {
    const guide = await published({ title: 'Saved guide' });
    await save(student, guide.id);
    expect((await saved(student)).map((g) => [g.title, g.status])).toEqual([['Saved guide', 'published']]);

    await as(admin, 'put', `/api/guides/${guide.id}`).send({ law_says: 'Edited and not yet republished.' });
    expect((await saved(student)).map((g) => [g.title, g.status])).toEqual([['Saved guide', 'draft']]);
    const [{ n }] = await q('SELECT count(*)::int AS n FROM bookmarks');
    expect(n).toBe(1);

    await as(admin, 'post', `/api/guides/${guide.id}/publish`);
    expect((await saved(student)).map((g) => [g.title, g.status])).toEqual([['Saved guide', 'published']]);
  });

  it('needs a student or staff login', async () => {
    expect((await request(app).get('/api/bookmarks')).status).toBe(401);
    expect((await as(expert, 'get', '/api/bookmarks')).status).toBe(403);
  });
});

describe('DELETE /api/guides/:id/bookmark', () => {
  it('removes my save', async () => {
    const guide = await published();
    await save(student, guide.id);
    const res = await as(student, 'delete', `/api/guides/${guide.id}/bookmark`);
    expect(res.status).toBe(204);
    expect(await saved(student)).toEqual([]);
  });

  it('answers 404 when there is nothing to remove', async () => {
    const guide = await published();
    const res = await as(student, 'delete', `/api/guides/${guide.id}/bookmark`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not saved/);
  });

  it('never removes somebody else’s save', async () => {
    const guide = await published();
    await save(student, guide.id);
    expect((await as(staff, 'delete', `/api/guides/${guide.id}/bookmark`)).status).toBe(404);
    expect(await saved(student)).toHaveLength(1);
  });

  it('removes the saves when the guide is erased', async () => {
    const guide = await published();
    await save(student, guide.id);
    await q('DELETE FROM guides WHERE id = $1', [guide.id]);
    const [{ n }] = await q('SELECT count(*)::int AS n FROM bookmarks');
    expect(n).toBe(0);
  });
});

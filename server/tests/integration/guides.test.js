// Guides: who can read them, who can write them and the steps from draft to published.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, guideBody } from '../helpers.js';

let admin;
let expert;
let student;

beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin', 'admin@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
  student = await makeUser('student', 'student@alustudent.com');
});

const create = (body = guideBody()) => request(app).post('/api/guides').set('Authorization', admin.auth).send(body);
const submit = (id) => request(app).post(`/api/guides/${id}/submit`).set('Authorization', admin.auth);
const verify = (id, who = expert) => request(app).post(`/api/guides/${id}/verify`).set('Authorization', who.auth);

// Makes a guide, submits it and has the expert verify it.
async function publish(body) {
  const { body: guide } = await create(body);
  await submit(guide.id);
  await verify(guide.id);
  return guide.id;
}

describe('reading guides (public)', () => {
  test('the list shows published guides only', async () => {
    const draft = (await create(guideBody({ title: 'A draft guide' }))).body.id;
    const published = await publish(guideBody({ title: 'A published guide' }));

    const res = await request(app).get('/api/guides');
    expect(res.status).toBe(200);
    expect(res.body.map((g) => g.id)).toEqual([published]);
    expect(res.body.map((g) => g.id)).not.toContain(draft);
  });

  test('a listed guide shows who verified it', async () => {
    await publish();
    const [guide] = (await request(app).get('/api/guides')).body;
    expect(guide.verified_by_name).toBe('Test legal_expert');
    expect(guide.verified_at).toBeTruthy();
  });

  test('a published guide can be read in full', async () => {
    const id = await publish();
    const res = await request(app).get(`/api/guides/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.situation).toBe(guideBody().situation);
  });

  test('a draft cannot be read: it gets the same 404 as a guide that does not exist', async () => {
    const { body } = await create();
    const res = await request(app).get(`/api/guides/${body.id}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Guide not found' });
  });

  test('an id that is not valid gets a 404, not a crash', async () => {
    for (const id of ['not-a-number', '0', '99999999999999999999']) {
      const res = await request(app).get(`/api/guides/${id}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    }
    // The server is still running.
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  test('search finds a guide by a word in its title', async () => {
    await publish(guideBody({ title: 'Getting your deposit back' }));
    await publish(guideBody({ title: 'Starting a business', situation: 'You want to register a company.', law_says: 'Law on companies.' }));
    const res = await request(app).get('/api/guides?search=deposit');
    expect(res.body.map((g) => g.title)).toEqual(['Getting your deposit back']);
  });
});

describe('creating a guide', () => {
  test('an admin creates a draft', async () => {
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.verified_by).toBeNull();
  });

  test('students and legal experts cannot create guides, and a login is needed', async () => {
    const asStudent = await request(app).post('/api/guides').set('Authorization', student.auth).send(guideBody());
    const asExpert = await request(app).post('/api/guides').set('Authorization', expert.auth).send(guideBody());
    const noLogin = await request(app).post('/api/guides').send(guideBody());
    expect(asStudent.status).toBe(403);
    expect(asExpert.status).toBe(403);
    expect(noLogin.status).toBe(401);
  });

  test('all template fields are needed, and the answer names the missing ones', async () => {
    const res = await create({ domain: 'tenancy', title: 'Only a title' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/situation/);
    expect(res.body.error).toMatch(/law_says/);
  });
});

describe('editing a guide', () => {
  test('sends a published guide back to draft and clears the verifier', async () => {
    const id = await publish();
    const res = await request(app).put(`/api/guides/${id}`).set('Authorization', admin.auth)
      .send({ your_rights: 'Revised text, not checked yet.' });

    expect(res.status).toBe(200);
    const [guide] = await q('SELECT status, verified_by, verified_at FROM guides WHERE id = $1', [id]);
    expect(guide.status).toBe('draft');
    expect(guide.verified_by).toBeNull();
    expect(guide.verified_at).toBeNull();
  });

  test('the edited guide disappears from the public pages', async () => {
    const id = await publish();
    expect((await request(app).get('/api/guides')).body).toHaveLength(1);

    await request(app).put(`/api/guides/${id}`).set('Authorization', admin.auth).send({});

    expect((await request(app).get(`/api/guides/${id}`)).status).toBe(404);
    expect((await request(app).get('/api/guides')).body).toHaveLength(0);
  });

  test('fields that are not sent keep their old value', async () => {
    const { body } = await create();
    const res = await request(app).put(`/api/guides/${body.id}`).set('Authorization', admin.auth)
      .send({ title: 'A new title' });
    expect(res.body.title).toBe('A new title');
    expect(res.body.situation).toBe(guideBody().situation);
  });

  test('only an admin can edit, and an unknown guide is a 404', async () => {
    const { body } = await create();
    const asExpert = await request(app).put(`/api/guides/${body.id}`).set('Authorization', expert.auth).send({});
    expect(asExpert.status).toBe(403);
    const missing = await request(app).put('/api/guides/9999').set('Authorization', admin.auth).send({});
    expect(missing.status).toBe(404);
  });
});

describe('submitting and verifying', () => {
  test('a draft can be submitted, then verified by a legal expert', async () => {
    const { body } = await create();
    const submitted = await submit(body.id);
    expect(submitted.body.status).toBe('pending_review');

    const verified = await verify(body.id);
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe('published');
    expect(verified.body.verified_by).toBe(expert.user.id);
    expect(verified.body.verified_at).not.toBeNull();
  });

  test('an admin cannot verify a guide, even their own', async () => {
    const { body } = await create();
    await submit(body.id);
    const res = await verify(body.id, admin);
    expect(res.status).toBe(403);
    const [guide] = await q('SELECT status FROM guides WHERE id = $1', [body.id]);
    expect(guide.status).toBe('pending_review');
  });

  test('only a draft can be submitted', async () => {
    const { body } = await create();
    await submit(body.id);
    expect((await submit(body.id)).status).toBe(400);
  });

  test('only a guide waiting for review can be verified', async () => {
    const { body } = await create();
    expect((await verify(body.id)).status).toBe(400);
  });
});

describe('GET /api/guides/all', () => {
  test('admins and legal experts see every guide, drafts included', async () => {
    await create(guideBody({ title: 'A draft' }));
    for (const who of [admin, expert]) {
      const res = await request(app).get('/api/guides/all').set('Authorization', who.auth);
      expect(res.status).toBe(200);
      expect(res.body.map((g) => g.title)).toEqual(['A draft']);
    }
  });

  test('students and visitors cannot use it', async () => {
    expect((await request(app).get('/api/guides/all').set('Authorization', student.auth)).status).toBe(403);
    expect((await request(app).get('/api/guides/all')).status).toBe(401);
  });
});

describe('the database', () => {
  test('refuses a published guide that has no verifier', async () => {
    const { body } = await create();
    await expect(q("UPDATE guides SET status = 'published' WHERE id = $1", [body.id]))
      .rejects.toThrow(/guides_published_is_verified/);
  });
});

import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { DOMAINS } from '../../src/routes/guides.js';
import { resetDb, makeUser, makeGuide, guideBody } from '../helpers.js';

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
const publicList = (query = '') => request(app).get(`/api/guides${query}`);
const published = (overrides = {}) => makeGuide(overrides, { verifiedBy: admin.user.id });
const publish = (who, id) => as(who, 'post', `/api/guides/${id}/publish`).send({});

describe('GET /api/guides (public)', () => {
  it('lists published guides only and without the full text', async () => {
    await published({ title: 'Published one' });
    await makeGuide({ title: 'A draft' });
    const pending = await makeGuide({ title: 'Waiting for review' });
    await q("UPDATE guides SET status = 'pending_review' WHERE id = $1", [pending.id]);
    const res = await publicList();
    expect(res.status).toBe(200);
    expect(res.body.map((g) => g.title)).toEqual(['Published one']);
    // has_service only says that a how-to block exists. The block itself is not on the list.
    expect(Object.keys(res.body[0]).sort()).toEqual(['domain', 'has_service', 'id', 'source_law', 'summary', 'title', 'verified_at']);
  });

  it('filters by area of law whatever the letter case', async () => {
    await published({ title: 'Rent guide', domain: 'tenancy' });
    await published({ title: 'Work guide', domain: 'employment' });
    expect((await publicList('?domain=tenancy')).body.map((g) => g.title)).toEqual(['Rent guide']);
    expect((await publicList('?domain=Employment')).body.map((g) => g.title)).toEqual(['Work guide']);
    expect((await publicList('?domain=astronomy')).body).toEqual([]);
  });

  it('searches the title and the text', async () => {
    await published({ title: 'Deposits', law_says: 'The landlord must return the deposit.' });
    await published({ title: 'Wages', law_says: 'The employer must pay the salary.' });
    expect((await publicList('?search=landlord')).body.map((g) => g.title)).toEqual(['Deposits']);
    expect((await publicList('?search=salary')).body.map((g) => g.title)).toEqual(['Wages']);
    expect((await publicList('?search=zebra')).body).toEqual([]);
  });

  it('finds nothing when the search is only small words or looks like SQL', async () => {
    await published();
    expect((await publicList('?search=the%20and%20of')).body).toEqual([]);
    const res = await publicList(`?search=${encodeURIComponent("x'; DROP TABLE guides; --")}`);
    expect(res.status).toBe(200);
    expect((await publicList()).body).toHaveLength(1);
  });

  it('puts the most recently verified guide first', async () => {
    const older = await published({ title: 'Older' });
    await published({ title: 'Newer' });
    await q("UPDATE guides SET verified_at = now() - interval '10 days' WHERE id = $1", [older.id]);
    expect((await publicList()).body.map((g) => g.title)).toEqual(['Newer', 'Older']);
  });
});

describe('GET /api/guides/:id (public)', () => {
  it('returns the whole guide and the name of the expert but no account id', async () => {
    const guide = await published();
    const res = await request(app).get(`/api/guides/${guide.id}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'domain', 'get_help', 'id', 'law_says', 'service', 'situation', 'source_law', 'source_url', 'steps',
      'summary', 'title', 'verified_at', 'your_rights']);
  });

  it('answers 404 for a guide that is not published, a missing guide and a bad id', async () => {
    const draft = await makeGuide();
    expect((await request(app).get(`/api/guides/${draft.id}`)).status).toBe(404);
    expect((await request(app).get('/api/guides/99999')).status).toBe(404);
    expect((await request(app).get('/api/guides/abc')).status).toBe(404);
  });

  it('answers 410 with the reason for a withdrawn guide, not a 404', async () => {
    const guide = await published({ title: 'Withdrawn one' });
    await as(admin, 'post', `/api/guides/${guide.id}/withdraw`).send({ comment: 'The cited article was repealed.' });
    const res = await request(app).get(`/api/guides/${guide.id}`);
    expect(res.status).toBe(410);
    expect(res.body.error).toBe('The cited article was repealed.');
  });
});

describe('GET /api/guides/all (staff)', () => {
  it('needs an admin login, never a legal expert or a student', async () => {
    expect((await request(app).get('/api/guides/all')).status).toBe(401);
    expect((await as(student, 'get', '/api/guides/all')).status).toBe(403);
    expect((await as(expert, 'get', '/api/guides/all')).status).toBe(403);
  });

  it('shows every state with the full text so the admin can read it before publishing', async () => {
    await makeGuide({ title: 'A draft', law_says: 'Text the admin must be able to read.' });
    await published({ title: 'Published one' });
    const res = await as(admin, 'get', '/api/guides/all');
    expect(res.status).toBe(200);
    expect(res.body.map((g) => g.status).sort()).toEqual(['draft', 'published']);
    expect(res.body.find((g) => g.title === 'A draft').law_says).toBe('Text the admin must be able to read.');
    expect(res.body[0]).not.toHaveProperty('verified_by');
  });
});

describe('POST /api/guides', () => {
  it('is for the admin only', async () => {
    expect((await request(app).post('/api/guides').send(guideBody())).status).toBe(401);
    expect((await as(student, 'post', '/api/guides').send(guideBody())).status).toBe(403);
    expect((await as(expert, 'post', '/api/guides').send(guideBody())).status).toBe(403);
  });

  it('creates a draft whatever the body says', async () => {
    const res = await as(admin, 'post', '/api/guides').send({ ...guideBody(), status: 'published', verified_by: admin.user.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Internship contracts', status: 'draft', verified_at: null });
    expect((await publicList()).body).toEqual([]);
  });

  it('writes the area of law in lower case', async () => {
    const res = await as(admin, 'post', '/api/guides').send(guideBody({ domain: '  Tenancy ' }));
    expect(res.status).toBe(201);
    expect(res.body.domain).toBe('tenancy');
  });

  it('does not need a source address', async () => {
    const res = await as(admin, 'post', '/api/guides').send(guideBody({ source_url: undefined }));
    expect(res.status).toBe(201);
    expect(res.body.source_url).toBeNull();
  });

  it('names every missing field of the template', async () => {
    const res = await as(admin, 'post', '/api/guides').send(guideBody({ law_says: '', steps: '   ', title: undefined }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing template fields: title, law_says, steps');
  });

  it('refuses a field that is not text', async () => {
    const res = await as(admin, 'post', '/api/guides').send(guideBody({ title: 42 }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing template fields: title/);
  });

  it('refuses an area of law that is not on the list', async () => {
    const res = await as(admin, 'post', '/api/guides').send(guideBody({ domain: 'criminal' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain(DOMAINS.join(', '));
  });

  it('refuses text that is too long and a source address that is not https', async () => {
    expect((await as(admin, 'post', '/api/guides').send(guideBody({ title: 'x'.repeat(201) }))).status).toBe(400);
    expect((await as(admin, 'post', '/api/guides').send(guideBody({ steps: 'x'.repeat(20001) }))).status).toBe(400);
    expect((await as(admin, 'post', '/api/guides').send(guideBody({ source_url: 'http://example.org' }))).status).toBe(400);
    expect((await as(admin, 'post', '/api/guides').send(guideBody({ source_url: 'javascript:alert(1)' }))).status).toBe(400);
  });
});

describe('PUT /api/guides/:id and the integrity rule', () => {
  const put = (id, body) => as(admin, 'put', `/api/guides/${id}`).send(body);

  it('takes a published guide off the site at once and clears the stamp', async () => {
    const guide = await published({ title: 'Verified guide' });
    expect((await request(app).get(`/api/guides/${guide.id}`)).status).toBe(200);

    const res = await put(guide.id, { law_says: 'A new sentence nobody has checked.' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'draft', verified_at: null });

    expect((await request(app).get(`/api/guides/${guide.id}`)).status).toBe(404);
    expect((await publicList()).body).toEqual([]);
    const [row] = await q('SELECT verified_by FROM guides WHERE id = $1', [guide.id]);
    expect(row.verified_by).toBeNull();
  });

  it('does that even for an edit that changes nothing', async () => {
    const guide = await published();
    expect((await put(guide.id, {})).body.status).toBe('draft');
  });

  it('keeps the fields that were not sent', async () => {
    const guide = await makeGuide({ title: 'Old title', steps: 'Keep these steps.' });
    const res = await put(guide.id, { title: 'New title' });
    expect(res.body).toMatchObject({ title: 'New title', steps: 'Keep these steps.' });
  });

  it('clears the source address when null is sent', async () => {
    const guide = await makeGuide();
    expect((await put(guide.id, { source_url: null })).body.source_url).toBeNull();
  });

  it('refuses a mistake before it takes a published guide off the site', async () => {
    const guide = await published();
    for (const bad of [{ domain: 'criminal' }, { situation: '' }, { title: 'x'.repeat(201) }, { source_url: 'ftp://example.org' }]) {
      expect((await put(guide.id, bad)).status).toBe(400);
    }
    const [row] = await q('SELECT status, verified_by FROM guides WHERE id = $1', [guide.id]);
    expect(row.status).toBe('published');
    expect(row.verified_by).toBe(admin.user.id);
    expect((await request(app).get(`/api/guides/${guide.id}`)).status).toBe(200);
  });

  it('is for the admin only, never a legal expert or a student, and answers 404 for an unknown guide', async () => {
    const guide = await published();
    expect((await as(student, 'put', `/api/guides/${guide.id}`).send({ title: 'X' })).status).toBe(403);
    expect((await as(expert, 'put', `/api/guides/${guide.id}`).send({ title: 'X' })).status).toBe(403);
    expect((await put(99999, { title: 'X' })).status).toBe(404);
    expect((await put('abc', { title: 'X' })).status).toBe(404);
    expect((await request(app).get(`/api/guides/${guide.id}`)).status).toBe(200);
  });
});

describe('publishing a guide', () => {
  it('is for the admin only, never a legal expert or a student', async () => {
    const guide = await makeGuide();
    expect((await publish(student, guide.id)).status).toBe(403);
    expect((await publish(expert, guide.id)).status).toBe(403);
    expect((await publish(admin, guide.id)).status).toBe(200);
  });

  it('stamps the admin and records a published review', async () => {
    const guide = await makeGuide();
    await publish(admin, guide.id);
    const [row] = await q('SELECT status, verified_by, verified_at FROM guides WHERE id = $1', [guide.id]);
    expect(row.status).toBe('published');
    expect(row.verified_by).toBe(admin.user.id);
    expect(row.verified_at).not.toBeNull();
    const reviews = await q('SELECT record_type, record_id, decision FROM directory_reviews');
    expect(reviews).toEqual([{ record_type: 'guide', record_id: guide.id, decision: 'published' }]);
  });

  it('refuses to publish a guide that is already published', async () => {
    const guide = await published();
    const res = await publish(admin, guide.id);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already published/);
  });

  it('goes from a new guide to the public and back out on an edit and in again after a new publish', async () => {
    const created = await as(admin, 'post', '/api/guides').send(guideBody());
    const id = created.body.id;
    await publish(admin, id);
    expect((await publicList()).body.map((g) => g.id)).toEqual([id]);

    await as(admin, 'put', `/api/guides/${id}`).send({ law_says: 'A corrected sentence.' });
    expect((await publicList()).body).toEqual([]);

    await publish(admin, id);
    const again = await request(app).get(`/api/guides/${id}`);
    expect(again.status).toBe(200);
    expect(again.body.law_says).toBe('A corrected sentence.');
  });
});

describe('withdrawing a guide', () => {
  const withdraw = (who, id, comment) => as(who, 'post', `/api/guides/${id}/withdraw`).send({ comment });

  it('is for the admin only, never a legal expert or a student', async () => {
    const guide = await published();
    expect((await request(app).post(`/api/guides/${guide.id}/withdraw`).send({ comment: 'x' })).status).toBe(401);
    expect((await withdraw(student, guide.id, 'x')).status).toBe(403);
    expect((await withdraw(expert, guide.id, 'x')).status).toBe(403);
    expect((await withdraw(admin, guide.id, 'A reason.')).status).toBe(200);
  });

  it('requires a reason', async () => {
    const guide = await published();
    const res = await withdraw(admin, guide.id, '  ');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Say why/);
    expect((await q('SELECT status FROM guides WHERE id = $1', [guide.id]))[0].status).toBe('published');
  });

  it('only withdraws a published guide, and takes it off the public list at once', async () => {
    const draft = await makeGuide();
    expect((await withdraw(admin, draft.id, 'x')).status).toBe(400);

    const guide = await published({ title: 'Goes away' });
    const res = await withdraw(admin, guide.id, 'The office changed its process.');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: guide.id, status: 'withdrawn' });
    expect((await publicList()).body).toEqual([]);
    const [row] = await q('SELECT status, verified_by, verified_at FROM guides WHERE id = $1', [guide.id]);
    expect(row).toEqual({ status: 'withdrawn', verified_by: null, verified_at: null });
  });

  it('records the reason as a review', async () => {
    const guide = await published();
    await withdraw(admin, guide.id, 'Superseded by a new law.');
    const [review] = await q(
      "SELECT record_type, record_id, decision, comment FROM directory_reviews WHERE record_type = 'guide' AND decision = 'withdrawn'");
    expect(review).toEqual({ record_type: 'guide', record_id: guide.id, decision: 'withdrawn', comment: 'Superseded by a new law.' });
  });

  it('answers 400 for a guide that is already withdrawn, not a second withdrawal', async () => {
    const guide = await published();
    await withdraw(admin, guide.id, 'First reason.');
    expect((await withdraw(admin, guide.id, 'Second reason.')).status).toBe(400);
  });
});

describe('the database rules for guides', () => {
  it('refuses a published guide with no verifier', async () => {
    const guide = await makeGuide();
    await expect(q("UPDATE guides SET status = 'published' WHERE id = $1", [guide.id]))
      .rejects.toThrow(/guides_published_is_verified/);
  });

  it('knows the same areas of law as the route', async () => {
    expect(DOMAINS).toEqual(['tenancy', 'employment', 'business', 'immigration', 'harassment', 'vehicles']);
    for (const domain of DOMAINS) {
      await expect(makeGuide({ title: `Guide ${domain}`, domain })).resolves.toBeTruthy();
    }
    await expect(makeGuide({ domain: 'criminal' })).rejects.toThrow(/guides_domain_check/);
  });
});

describe('the summary of a guide', () => {
  it('is saved with a new guide and shown in the public list and the public guide', async () => {
    const created = await as(admin, 'post', '/api/guides').send(guideBody({ summary: '  How to get a deposit back.  ' }));
    expect(created.status).toBe(201);
    expect(created.body.summary).toBe('How to get a deposit back.');
    await publish(admin, created.body.id);
    expect((await publicList()).body[0].summary).toBe('How to get a deposit back.');
    expect((await request(app).get(`/api/guides/${created.body.id}`)).body.summary).toBe('How to get a deposit back.');
  });

  it('is optional and empty means none', async () => {
    const res = await as(admin, 'post', '/api/guides').send(guideBody({ summary: '' }));
    expect(res.status).toBe(201);
    expect(res.body.summary).toBeNull();
  });

  it('is null for a guide written before summaries existed', async () => {
    await published();
    expect((await publicList()).body[0].summary).toBeNull();
  });

  it('refuses a summary of more than 280 characters and accepts exactly 280', async () => {
    const tooLong = await as(admin, 'post', '/api/guides').send(guideBody({ summary: 'x'.repeat(281) }));
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error).toMatch(/summary/);
    const exact = await as(admin, 'post', '/api/guides').send(guideBody({ summary: 'x'.repeat(280) }));
    expect(exact.status).toBe(201);
  });

  it('sends a published guide back to draft when the summary changes', async () => {
    const guide = await published();
    const res = await as(admin, 'put', `/api/guides/${guide.id}`).send({ summary: 'A new line.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.summary).toBe('A new line.');
    expect((await publicList()).body).toEqual([]);
  });

  it('keeps the summary when a later edit does not send it and clears it when sent empty', async () => {
    const guide = await published();
    await as(admin, 'put', `/api/guides/${guide.id}`).send({ summary: 'Keep me.' });
    const kept = await as(admin, 'put', `/api/guides/${guide.id}`).send({ title: 'A better title' });
    expect(kept.body.summary).toBe('Keep me.');
    const cleared = await as(admin, 'put', `/api/guides/${guide.id}`).send({ summary: '' });
    expect(cleared.body.summary).toBeNull();
  });

  it('shows the summary to staff in the full list', async () => {
    const guide = await published();
    await as(admin, 'put', `/api/guides/${guide.id}`).send({ summary: 'Staff can see me.' });
    const res = await as(admin, 'get', '/api/guides/all');
    expect(res.body[0].summary).toBe('Staff can see me.');
  });

  it('refuses a summary that is not text', async () => {
    for (const bad of [123, { a: 'x' }, ['x'.repeat(300)]]) {
      const res = await as(admin, 'post', '/api/guides').send(guideBody({ summary: bad }));
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/summary/);
    }
  });

  it('leaves a published guide published when an edit with a long summary is refused', async () => {
    const guide = await published();
    const res = await as(admin, 'put', `/api/guides/${guide.id}`).send({ summary: 'x'.repeat(281) });
    expect(res.status).toBe(400);
    const [row] = await q('SELECT status, summary, verified_by FROM guides WHERE id = $1', [guide.id]);
    expect(row.status).toBe('published');
    expect(row.summary).toBeNull();
    expect(row.verified_by).not.toBeNull();
  });

  it('refuses a database row with a long summary', async () => {
    await expect(q("INSERT INTO guides (domain, title, situation, law_says, your_rights, steps, get_help, source_law, summary) VALUES ('tenancy','t','s','l','r','st','g','sl',$1)", ['x'.repeat(281)]))
      .rejects.toThrow();
  });
});

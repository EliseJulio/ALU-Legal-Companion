import request from 'supertest';
import app from '../../src/app.js';
import { resetDb, makeUser, makeGuide } from '../helpers.js';

let admin;
let student;
let expert;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
  student = await makeUser('student');
  expert = await makeUser('legal_expert');
});

const list = (query = '') => request(app).get(`/api/guides${query}`);
const published = (overrides = {}) => makeGuide(overrides, { verifiedBy: admin.user.id });

describe('the public guide library', () => {
  it('lists published guides only', async () => {
    await published({ title: 'Published one' });
    await makeGuide({ title: 'A draft' });
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.map((g) => g.title)).toEqual(['Published one']);
  });

  it('does not send the full text on the list', async () => {
    await published();
    expect(Object.keys((await list()).body[0])).not.toContain('law_says');
  });

  it('opens a published guide with its law and its steps', async () => {
    const guide = await published();
    const res = await request(app).get(`/api/guides/${guide.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Internship contracts', source_law: 'Law No. 66/2018 of 30/08/2018' });
    expect(res.body.law_says).toBeTruthy();
  });
});

describe('drafts stay hidden', () => {
  it('answers 404 to the public for a draft guide', async () => {
    const draft = await makeGuide();
    expect((await request(app).get(`/api/guides/${draft.id}`)).status).toBe(404);
  });

  it('keeps the list of every guide, drafts included, for the admin only', async () => {
    await makeGuide({ title: 'A draft' });
    expect((await request(app).get('/api/guides/all')).status).toBe(401);
    expect((await request(app).get('/api/guides/all').set('Authorization', student.auth)).status).toBe(403);
    expect((await request(app).get('/api/guides/all').set('Authorization', expert.auth)).status).toBe(403);
    const res = await request(app).get('/api/guides/all').set('Authorization', admin.auth);
    expect(res.body.map((g) => g.title)).toEqual(['A draft']);
  });

  it('gives a withdrawn guide a 410 with the reason instead of its text', async () => {
    const guide = await published();
    await request(app).post(`/api/guides/${guide.id}/withdraw`).set('Authorization', admin.auth)
      .send({ comment: 'The cited article was repealed.' });
    const res = await request(app).get(`/api/guides/${guide.id}`);
    expect(res.status).toBe(410);
    expect(res.body.error).toBe('The cited article was repealed.');
  });
});

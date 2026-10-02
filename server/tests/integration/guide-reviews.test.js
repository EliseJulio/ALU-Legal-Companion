// The expert's review comment: a legal expert can send a guide back with the reason and the
// admin sees that reason.
//
// The tests read the guide again in a separate request the way the admin would. Checking only
// the answer of the "return" request would pass even if the comment was never saved.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, guideBody } from '../helpers.js';

let admin;
let expert;

beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin', 'admin@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
});

// Makes a guide and puts it in the review queue.
async function guideAwaitingReview() {
  const created = await request(app).post('/api/guides').set('Authorization', admin.auth).send(guideBody());
  await request(app).post(`/api/guides/${created.body.id}/submit`).set('Authorization', admin.auth).expect(200);
  return created.body.id;
}

// The admin reads the guide again, from the list they use.
async function adminSees(id) {
  const all = await request(app).get('/api/guides/all').set('Authorization', admin.auth);
  expect(all.status).toBe(200);
  const row = all.body.find((g) => g.id === id);
  expect(row).toBeDefined();
  return row;
}

const returnGuide = (id, comment, who = expert) =>
  request(app).post(`/api/guides/${id}/return`).set('Authorization', who.auth).send({ comment });
const submit = (id) => request(app).post(`/api/guides/${id}/submit`).set('Authorization', admin.auth);
const verify = (id) => request(app).post(`/api/guides/${id}/verify`).set('Authorization', expert.auth);

describe('returning a guide', () => {
  test('sends the guide back to draft, and the admin sees the comment', async () => {
    const id = await guideAwaitingReview();
    const reason = 'Article 8 is misquoted. Check the 2018 consolidated text.';

    const res = await returnGuide(id, reason);
    expect(res.status).toBe(200);
    expect(res.body.review_comment).toBe(reason);

    const row = await adminSees(id);
    expect(row.status).toBe('draft');
    expect(row.review_comment).toBe(reason);
    expect(row.review_comment_by_name).toBe(expert.user.name);
    expect(row.review_comment_at).not.toBeNull();
  });

  test('needs a reason, and the guide stays in the review queue if there is none', async () => {
    const id = await guideAwaitingReview();
    const res = await returnGuide(id, '   ');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/what needs changing/i);

    const [guide] = await q('SELECT status FROM guides WHERE id = $1', [id]);
    expect(guide.status).toBe('pending_review');
    expect(await q('SELECT id FROM guide_reviews WHERE guide_id = $1', [id])).toHaveLength(0);
  });

  test('only a legal expert can return a guide', async () => {
    const id = await guideAwaitingReview();
    expect((await returnGuide(id, 'No.', admin)).status).toBe(403);
  });

  test('only a guide waiting for review can be returned', async () => {
    const created = await request(app).post('/api/guides').set('Authorization', admin.auth).send(guideBody());
    const res = await returnGuide(created.body.id, 'Not in the queue.');
    expect(res.status).toBe(400);
  });

  test('a bad id is a 404', async () => {
    expect((await returnGuide('abc', 'x')).status).toBe(404);
  });
});

describe('the comment over time', () => {
  test('stays while the guide is back in the queue, and goes once it is verified', async () => {
    const id = await guideAwaitingReview();
    await returnGuide(id, 'Needs the article number for the notice period.');
    expect((await adminSees(id)).review_comment).toBe('Needs the article number for the notice period.');

    // Still shown after the admin submits it again so the expert can see what they asked for.
    await submit(id);
    expect((await adminSees(id)).review_comment).toBe('Needs the article number for the notice period.');

    await verify(id);
    const published = await adminSees(id);
    expect(published.status).toBe('published');
    expect(published.review_comment).toBeNull();
  });

  test('an admin edit later does not bring back an old comment', async () => {
    // Every edit sends a published guide back to draft. That draft is the admin's work so it
    // must not show a comment from a review that is already finished.
    const id = await guideAwaitingReview();
    await returnGuide(id, 'First pass: fix the citation.');
    await submit(id);
    await verify(id);

    const edited = await request(app).put(`/api/guides/${id}`)
      .set('Authorization', admin.auth).send({ your_rights: 'Revised text.' });
    expect(edited.status).toBe(200);

    const row = await adminSees(id);
    expect(row.status).toBe('draft');
    expect(row.review_comment).toBeNull();
  });

  test('a second return replaces the first for the admin, and both are kept as history', async () => {
    const id = await guideAwaitingReview();
    await returnGuide(id, 'First: Article 8 is wrong.');
    await submit(id);
    await returnGuide(id, 'Second: still wrong, cite Law No. 66/2018.');

    expect((await adminSees(id)).review_comment).toBe('Second: still wrong, cite Law No. 66/2018.');

    const history = await q('SELECT decision, comment FROM guide_reviews WHERE guide_id = $1 ORDER BY id', [id]);
    expect(history.map((r) => r.comment)).toEqual(['First: Article 8 is wrong.', 'Second: still wrong, cite Law No. 66/2018.']);
    expect(history.every((r) => r.decision === 'returned')).toBe(true);
  });

  test('verifying is also saved as a decision', async () => {
    const id = await guideAwaitingReview();
    await verify(id);
    const [row] = await q('SELECT decision, reviewer_id, comment FROM guide_reviews WHERE guide_id = $1', [id]);
    expect(row.decision).toBe('verified');
    expect(row.reviewer_id).toBe(expert.user.id);
    expect(row.comment).toBeNull();
  });
});

describe('the database', () => {
  test('refuses a return with no comment', async () => {
    const id = await guideAwaitingReview();
    await expect(q(
      "INSERT INTO guide_reviews (guide_id, reviewer_id, decision) VALUES ($1, $2, 'returned')",
      [id, expert.user.id],
    )).rejects.toThrow(/guide_reviews_check/);
  });
});

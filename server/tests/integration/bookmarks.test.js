// Saved guides for signed-in students and staff.
// The part worth testing is how a saved guide behaves under the integrity rule. An edited guide
// un-publishes and must leave the saved list. The row stays, so it returns when a legal expert
// verifies the guide again.
// There is no anonymous version because a saved list tied to a token would be a lasting
// record of what an anonymous person read.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, guideBody } from '../helpers.js';

let admin, expert, student, otherStudent;

// Makes a guide and takes it to published, the only state a guide can be saved in.
async function publishedGuide(overrides = {}) {
  const created = await request(app)
    .post('/api/guides').set('Authorization', admin.auth).send(guideBody(overrides));
  const id = created.body.id;
  await request(app).post(`/api/guides/${id}/submit`).set('Authorization', admin.auth);
  await request(app).post(`/api/guides/${id}/verify`).set('Authorization', expert.auth);
  return id;
}

beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin', 'admin@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
  student = await makeUser('student', 'student@alustudent.com');
  otherStudent = await makeUser('student', 'other@alustudent.com');
});

describe('Adding a bookmark', () => {
  test('a student can save a published guide', async () => {
    const id = await publishedGuide();
    const res = await request(app)
      .post(`/api/guides/${id}/bookmark`).set('Authorization', student.auth);
    expect(res.status).toBe(201);
  });

  test('saving twice is fine: no second row and no error', async () => {
    const id = await publishedGuide();
    await request(app).post(`/api/guides/${id}/bookmark`).set('Authorization', student.auth);
    const second = await request(app)
      .post(`/api/guides/${id}/bookmark`).set('Authorization', student.auth);
    expect(second.status).toBe(201);

    const rows = await q('SELECT count(*)::int AS n FROM bookmarks WHERE user_id = $1', [student.user.id]);
    expect(rows[0].n).toBe(1);
  });

  test('a draft guide cannot be saved, and the 404 is the same as reading it', async () => {
    const created = await request(app)
      .post('/api/guides').set('Authorization', admin.auth).send(guideBody());
    const res = await request(app)
      .post(`/api/guides/${created.body.id}/bookmark`).set('Authorization', student.auth);
    expect(res.status).toBe(404);
  });

  test('a bad guide id is a 404, not a crash', async () => {
    const res = await request(app)
      .post('/api/guides/not-a-number/bookmark').set('Authorization', student.auth);
    expect(res.status).toBe(404);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  test('needs a session', async () => {
    const id = await publishedGuide();
    const res = await request(app).post(`/api/guides/${id}/bookmark`);
    expect(res.status).toBe(401);
  });

  test('a legal expert cannot save, because the feature is for students and staff', async () => {
    const id = await publishedGuide();
    const res = await request(app)
      .post(`/api/guides/${id}/bookmark`).set('Authorization', expert.auth);
    expect(res.status).toBe(403);
  });
});

describe('Listing bookmarks', () => {
  test('returns the guides this user saved, and nobody else’s', async () => {
    const mine = await publishedGuide({ title: 'Mine' });
    const theirs = await publishedGuide({ title: 'Theirs' });
    await request(app).post(`/api/guides/${mine}/bookmark`).set('Authorization', student.auth);
    await request(app).post(`/api/guides/${theirs}/bookmark`).set('Authorization', otherStudent.auth);

    const res = await request(app).get('/api/bookmarks').set('Authorization', student.auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Mine');
  });

  test('has enough to draw a guide card without a second request', async () => {
    const id = await publishedGuide();
    await request(app).post(`/api/guides/${id}/bookmark`).set('Authorization', student.auth);

    const [row] = (await request(app).get('/api/bookmarks').set('Authorization', student.auth)).body;
    for (const field of ['id', 'domain', 'title', 'source_law', 'verified_at', 'bookmarked_at']) {
      expect(row).toHaveProperty(field);
    }
  });

  test('never includes the five template sections, because the list is a card and not the guide', async () => {
    const id = await publishedGuide();
    await request(app).post(`/api/guides/${id}/bookmark`).set('Authorization', student.auth);

    const [row] = (await request(app).get('/api/bookmarks').set('Authorization', student.auth)).body;
    for (const heavy of ['situation', 'law_says', 'your_rights', 'steps', 'get_help']) {
      expect(row).not.toHaveProperty(heavy);
    }
  });

  test('needs a session', async () => {
    expect((await request(app).get('/api/bookmarks')).status).toBe(401);
  });
});

describe('Bookmarks follow the integrity rule', () => {
  test('an edited guide leaves the saved list, then returns when it is verified again', async () => {
    const id = await publishedGuide();
    await request(app).post(`/api/guides/${id}/bookmark`).set('Authorization', student.auth);

    const before = await request(app).get('/api/bookmarks').set('Authorization', student.auth);
    expect(before.body).toHaveLength(1);

    // An edit sends the guide back to draft, so it is no longer verified content.
    await request(app).put(`/api/guides/${id}`)
      .set('Authorization', admin.auth).send({ situation: 'Rewritten.' });

    const during = await request(app).get('/api/bookmarks').set('Authorization', student.auth);
    expect(during.body).toHaveLength(0);

    // The saved row is still there. It was hidden, not deleted.
    const rows = await q('SELECT count(*)::int AS n FROM bookmarks WHERE user_id = $1', [student.user.id]);
    expect(rows[0].n).toBe(1);

    // Verifying again brings it back with nothing for the user to do.
    await request(app).post(`/api/guides/${id}/submit`).set('Authorization', admin.auth);
    await request(app).post(`/api/guides/${id}/verify`).set('Authorization', expert.auth);

    const after = await request(app).get('/api/bookmarks').set('Authorization', student.auth);
    expect(after.body).toHaveLength(1);
  });
});

describe('Removing a bookmark', () => {
  test('deletes it and returns 204', async () => {
    const id = await publishedGuide();
    await request(app).post(`/api/guides/${id}/bookmark`).set('Authorization', student.auth);

    const res = await request(app)
      .delete(`/api/guides/${id}/bookmark`).set('Authorization', student.auth);
    expect(res.status).toBe(204);

    const list = await request(app).get('/api/bookmarks').set('Authorization', student.auth);
    expect(list.body).toHaveLength(0);
  });

  test('removing one that was never saved is a 404', async () => {
    const id = await publishedGuide();
    const res = await request(app)
      .delete(`/api/guides/${id}/bookmark`).set('Authorization', student.auth);
    expect(res.status).toBe(404);
  });

  test('one user cannot remove another user’s bookmark', async () => {
    const id = await publishedGuide();
    await request(app).post(`/api/guides/${id}/bookmark`).set('Authorization', student.auth);

    const res = await request(app)
      .delete(`/api/guides/${id}/bookmark`).set('Authorization', otherStudent.auth);
    expect(res.status).toBe(404);

    // The owner's bookmark is still there.
    const list = await request(app).get('/api/bookmarks').set('Authorization', student.auth);
    expect(list.body).toHaveLength(1);
  });
});

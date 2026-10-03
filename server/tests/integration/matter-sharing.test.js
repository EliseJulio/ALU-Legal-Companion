// Sharing a matter with a legal expert.
// The expert can read and add notes only while the matter is shared. They never see who owns
// it. Stopping the share ends their access on the very next request.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';
import { addDays, kigaliToday } from '../../src/services/reminders.js';

let expert, student, other, lawyer;

beforeEach(async () => {
  await resetDb();
  expert = await makeUser('legal_expert', 'expert.s@example.org');
  student = await makeUser('student', 'student.s@alustudent.com');
  other = await makeUser('student', 'other.s@alustudent.com');
  lawyer = await makeProvider({ name: 'Adv. Amani', type: 'pro_bono_lawyer' }, { verifiedBy: expert.user.id });
  await q('UPDATE providers SET user_id = $1 WHERE id = $2', [expert.user.id, lawyer.id]);
});

const post = (user, body) => request(app).post('/api/matters').set('Authorization', user.auth).send(body);
const share = (m, providerId, user = student) =>
  request(app).post(`/api/matters/${m}/share`).set('Authorization', user.auth).send({ provider_id: providerId });

describe('sharing a matter with a legal expert', () => {
  it('offers only published entries with an expert login, and hides the login id', async () => {
    await makeProvider({ name: 'Unlinked office' }, { verifiedBy: expert.user.id });
    const res = await request(app).get('/api/matters/share-targets').set('Authorization', student.auth);
    expect(res.body.map((p) => p.name)).toEqual(['Adv. Amani']);
    expect(res.body[0]).not.toHaveProperty('user_id');
  });

  it('lets the expert read and add notes only while it is shared, and never shows the owner', async () => {
    const { body: m } = await post(student, { title: 'Wages', next_due: addDays(kigaliToday(), 10) });
    expect((await request(app).get(`/api/matters/${m.id}`).set('Authorization', expert.auth)).status).toBe(404);

    expect((await share(m.id, lawyer.id)).status).toBe(200);
    const list = await request(app).get('/api/matters/shared').set('Authorization', expert.auth);
    expect(list.body.map((x) => x.title)).toEqual(['Wages']);
    expect(list.body[0]).not.toHaveProperty('user_id');

    const seen = await request(app).get(`/api/matters/${m.id}`).set('Authorization', expert.auth);
    expect(seen.status).toBe(200);
    expect(seen.body.viewer).toBe('expert');
    expect(seen.body).not.toHaveProperty('user_id');
    expect(seen.body.reminders).toEqual([]); // the reminder schedule is the owner's alone

    const note = await request(app).post(`/api/matters/${m.id}/events`).set('Authorization', expert.auth)
      .send({ description: 'Bring your contract and payslips.' });
    expect(note.status).toBe(201);
    expect(note.body.author_is_owner).toBe(false);

    // The expert cannot edit, delete or share it again.
    expect((await request(app).put(`/api/matters/${m.id}`).set('Authorization', expert.auth).send({ title: 'x' })).status).toBe(403);
    expect((await request(app).delete(`/api/matters/${m.id}`).set('Authorization', expert.auth)).status).toBe(403);

    // The owner sees the note as the expert's, by name.
    const own = await request(app).get(`/api/matters/${m.id}`).set('Authorization', student.auth);
    const expertNote = own.body.events.find((e) => !e.author_is_owner);
    expect(expertNote.author_name).toBe('Test legal_expert');

    // Stopping the share ends access on the very next request.
    expect((await request(app).delete(`/api/matters/${m.id}/share`).set('Authorization', student.auth)).status).toBe(200);
    expect((await request(app).get(`/api/matters/${m.id}`).set('Authorization', expert.auth)).status).toBe(404);
    expect((await request(app).post(`/api/matters/${m.id}/events`).set('Authorization', expert.auth).send({ description: 'x' })).status).toBe(404);
    expect((await request(app).get('/api/matters/shared').set('Authorization', expert.auth)).body).toEqual([]);
  });

  it('records sharing and stopping in the matter’s own history', async () => {
    const { body: m } = await post(student, { title: 'x' });
    await share(m.id, lawyer.id);
    await request(app).delete(`/api/matters/${m.id}/share`).set('Authorization', student.auth);
    const own = await request(app).get(`/api/matters/${m.id}`).set('Authorization', student.auth);
    expect(own.body.events.map((e) => e.description).sort()).toEqual(['Shared with Adv. Amani', 'Stopped sharing with Adv. Amani']);
  });

  it('refuses an entry with no expert login, and only the owner can share', async () => {
    const office = await makeProvider({ name: 'Office' }, { verifiedBy: expert.user.id });
    const { body: m } = await post(student, { title: 'x' });
    expect((await share(m.id, office.id)).status).toBe(400);
    expect((await share(m.id, lawyer.id, other)).status).toBe(404);
  });

  it('refuses an entry that is no longer published', async () => {
    const { body: m } = await post(student, { title: 'x' });
    await q(`UPDATE providers SET status = 'draft', verified_by = NULL, verified_at = NULL WHERE id = $1`, [lawyer.id]);
    expect((await share(m.id, lawyer.id)).status).toBe(400);
  });

  it('a different expert sees nothing', async () => {
    const second = await makeUser('legal_expert', 'second.expert@example.org');
    const { body: m } = await post(student, { title: 'x' });
    await share(m.id, lawyer.id);
    expect((await request(app).get(`/api/matters/${m.id}`).set('Authorization', second.auth)).status).toBe(404);
    expect((await request(app).get('/api/matters/shared').set('Authorization', second.auth)).body).toEqual([]);
  });

  it('the database refuses a share with no date', async () => {
    const { body: m } = await post(student, { title: 'x' });
    await expect(q('UPDATE matters SET shared_with = $1 WHERE id = $2', [lawyer.id, m.id]))
      .rejects.toThrow(/matters_shared_pair/);
  });
});

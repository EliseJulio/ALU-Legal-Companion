// The account behind a directory entry can read every matter shared with that entry. Passports and
// IDs among them. So changing that account must not hand those matters to whoever an admin links next.
// The owners agreed to share with an office and not with a new account. Those shares end and the owner
// is told.
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

let admin;
let student;
let expert;
let second;
let office;
let matter;

beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin', 'admin@example.org');
  student = await makeUser('student', 'student@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
  second = await makeUser('legal_expert', 'second@example.org');
  office = await makeProvider({ name: 'Adv. Amani', category: 'lawyer', type: 'pro_bono_lawyer' }, { verifiedBy: expert.user.id });
  await q('UPDATE providers SET user_id = $1 WHERE id = $2', [expert.user.id, office.id]);
  matter = (await request(app).post('/api/matters').set('Authorization', student.auth).send({ title: 'Buying a car' })).body;
  await request(app).post(`/api/matters/${matter.id}/share`).set('Authorization', student.auth).send({ provider_id: office.id }).expect(200);
});

const put = (body) => request(app).put(`/api/directory/providers/${office.id}`).set('Authorization', admin.auth).send(body);
const shared = async () => (await q('SELECT shared_with FROM matters WHERE id = $1', [matter.id]))[0].shared_with;
const events = async () => q('SELECT description, author_id FROM matter_events WHERE matter_id = $1 ORDER BY id', [matter.id]);

describe('changing the account behind an entry', () => {
  it('ends every share with that entry and tells the owner in their own history', async () => {
    expect(await shared()).toBe(office.id);
    await put({ user_id: second.user.id }).expect(200);
    expect(await shared()).toBeNull();
    const last = (await events()).at(-1);
    expect(last.description).toMatch(/Sharing with Adv\. Amani ended/);
    expect(last.author_id).toBe(student.user.id); // under the owner, like "Stopped sharing". It never passes for a lawyer's note
    // The old lawyer lost access on the very next request. The new one never had it.
    expect((await request(app).get(`/api/matters/${matter.id}`).set('Authorization', expert.auth)).status).toBe(404);
    expect((await request(app).get(`/api/matters/${matter.id}`).set('Authorization', second.auth)).status).toBe(404);
  });

  it('removing the link ends the shares too', async () => {
    await put({ user_id: null }).expect(200);
    expect(await shared()).toBeNull();
  });

  it('an edit that leaves the account alone keeps the share', async () => {
    await put({ bookable: false }).expect(200);
    await put({ user_id: expert.user.id }).expect(200); // the same account again
    expect(await shared()).toBe(office.id);
  });

  it('ends only the shares with this entry', async () => {
    const otherOffice = await makeProvider({ name: 'Adv. Bosco', category: 'lawyer', type: 'pro_bono_lawyer' }, { verifiedBy: second.user.id });
    await q('UPDATE providers SET user_id = $1 WHERE id = $2', [second.user.id, otherOffice.id]);
    const m2 = (await request(app).post('/api/matters').set('Authorization', student.auth).send({ title: 'Another' })).body;
    await request(app).post(`/api/matters/${m2.id}/share`).set('Authorization', student.auth).send({ provider_id: otherOffice.id }).expect(200);
    await put({ user_id: null }).expect(200);
    expect((await q('SELECT shared_with FROM matters WHERE id = $1', [m2.id]))[0].shared_with).toBe(otherOffice.id);
  });
});

describe('who an entry can be linked to', () => {
  it('refuses an account that is not a legal expert', async () => {
    expect((await put({ user_id: student.user.id })).status).toBe(400);
    expect((await put({ user_id: admin.user.id })).status).toBe(400);
    expect(await shared()).toBe(office.id);
  });

  it('refuses a legal expert account that has been switched off', async () => {
    await request(app).post(`/api/admin/users/${second.user.id}/deactivate`).set('Authorization', admin.auth).expect(200);
    const res = await put({ user_id: second.user.id });
    expect(res.status).toBe(400);
    expect(await shared()).toBe(office.id); // a refused change changes nothing
  });
});

describe('what one lawyer sees of another', () => {
  it('a lawyer who gets a matter later reads the earlier notes as nameless', async () => {
    await request(app).post(`/api/matters/${matter.id}/events`).set('Authorization', expert.auth).send({ description: 'First lawyer note.' }).expect(201);
    await request(app).delete(`/api/matters/${matter.id}/share`).set('Authorization', student.auth).expect(200);
    const otherOffice = await makeProvider({ name: 'Adv. Bosco', category: 'lawyer', type: 'pro_bono_lawyer' }, { verifiedBy: second.user.id });
    await q('UPDATE providers SET user_id = $1 WHERE id = $2', [second.user.id, otherOffice.id]);
    await request(app).post(`/api/matters/${matter.id}/share`).set('Authorization', student.auth).send({ provider_id: otherOffice.id }).expect(200);
    const seen = (await request(app).get(`/api/matters/${matter.id}`).set('Authorization', second.auth)).body.events;
    expect(seen.find((e) => e.description === 'First lawyer note.')).toBeTruthy();
    expect(seen.every((e) => e.author_name === null)).toBe(true);
    expect(JSON.stringify(seen)).not.toMatch(/Test legal_expert/);
  });
});

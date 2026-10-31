import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { kigaliToday, addDays } from '../../src/services/reminders.js';
import { resetDb, makeUser, makeProvider, makeMatter } from '../helpers.js';

const today = kigaliToday();
const inDays = (n) => addDays(today, n);

let owner;
let other;
let expert; // linked to `entry`
let otherExpert; // linked to `otherEntry`
let entry;
let otherEntry;
let matter;
beforeEach(async () => {
  await resetDb();
  owner = await makeUser('student', 'owner.student@alustudent.com');
  other = await makeUser('staff', 'other.person@alueducation.com');
  expert = await makeUser('legal_expert');
  otherExpert = await makeUser('legal_expert', 'other.expert@example.org');
  entry = await makeProvider({ name: 'Expert Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', user_id: expert.user.id },
    { verifiedBy: expert.user.id });
  otherEntry = await makeProvider({ name: 'Second Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', user_id: otherExpert.user.id },
    { verifiedBy: expert.user.id });
  matter = await makeMatter(owner.user.id, { title: 'Deposit matter', next_due: inDays(9) });
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const share = (who, id, providerId) => as(who, 'post', `/api/matters/${id}/share`).send({ provider_id: providerId });
const unshare = (who, id) => as(who, 'delete', `/api/matters/${id}/share`);

describe('GET /api/matters/share-targets', () => {
  it('lists published entries that have an expert account and no account ids', async () => {
    await makeProvider({ name: 'Office Without Account' }, { verifiedBy: expert.user.id });
    await makeProvider({ name: 'Draft With Account', user_id: expert.user.id });
    const res = await as(owner, 'get', '/api/matters/share-targets');
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.name)).toEqual(['Expert Lawyer', 'Second Lawyer']);
    expect(Object.keys(res.body[0]).sort()).toEqual(['category', 'id', 'location', 'name', 'type']);
  });

  it('is for students and staff only', async () => {
    expect((await request(app).get('/api/matters/share-targets')).status).toBe(401);
    expect((await as(expert, 'get', '/api/matters/share-targets')).status).toBe(403);
  });
});

describe('POST /api/matters/:id/share', () => {
  it('shares a matter with one entry and writes a line in its history', async () => {
    const res = await share(owner, matter.id, entry.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ shared_with: entry.id, shared_with_name: 'Expert Lawyer' });
    expect(res.body.shared_at).toBeTruthy();
    const detail = await as(owner, 'get', `/api/matters/${matter.id}`);
    expect(detail.body.events.map((e) => e.description)).toContain('Shared with Expert Lawyer');
  });

  it('replaces an earlier share so the matter is shared with one place at a time', async () => {
    await share(owner, matter.id, entry.id);
    const res = await share(owner, matter.id, otherEntry.id);
    expect(res.body.shared_with).toBe(otherEntry.id);
    expect((await as(expert, 'get', `/api/matters/${matter.id}`)).status).toBe(404);
    expect((await as(otherExpert, 'get', `/api/matters/${matter.id}`)).status).toBe(200);
  });

  it('refuses an entry that cannot receive a matter', async () => {
    const noAccount = await makeProvider({ name: 'Office Without Account' }, { verifiedBy: expert.user.id });
    const draft = await makeProvider({ name: 'Draft With Account', user_id: expert.user.id });
    for (const id of [noAccount.id, draft.id, 99999]) {
      const res = await share(owner, matter.id, id);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot receive shared matters/);
    }
    expect((await share(owner, matter.id, 'abc')).status).toBe(400);
    expect((await share(owner, matter.id, undefined)).status).toBe(400);
  });

  it('answers 404 when somebody else tries to share a matter', async () => {
    expect((await share(other, matter.id, entry.id)).status).toBe(404);
    expect((await share(expert, matter.id, entry.id)).status).toBe(403);
    const [row] = await q('SELECT shared_with FROM matters WHERE id = $1', [matter.id]);
    expect(row.shared_with).toBeNull();
  });
});

describe('what the expert can see', () => {
  beforeEach(async () => {
    await as(owner, 'post', `/api/matters/${matter.id}/events`).send({ description: 'Wrote to the landlord' });
    await share(owner, matter.id, entry.id);
  });

  it('lists the shared matter without naming the owner', async () => {
    const res = await as(expert, 'get', '/api/matters/shared');
    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.title)).toEqual(['Deposit matter']);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('owner.student@alustudent.com');
    expect(text).not.toContain('Test student');
    expect(res.body[0]).not.toHaveProperty('user_id');
  });

  it('does not list the matter for another expert', async () => {
    expect((await as(otherExpert, 'get', '/api/matters/shared')).body).toEqual([]);
  });

  it('shows the matter and its history but not the reminders or the owner', async () => {
    const res = await as(expert, 'get', `/api/matters/${matter.id}`);
    expect(res.status).toBe(200);
    expect(res.body.viewer).toBe('expert');
    expect(res.body.reminders).toEqual([]);
    expect(res.body).not.toHaveProperty('shared_with');
    expect(res.body).not.toHaveProperty('shared_at');
    expect(res.body).not.toHaveProperty('user_id');
    expect(JSON.stringify(res.body)).not.toContain('owner.student@alustudent.com');
    expect(res.body.events.find((e) => e.description === 'Wrote to the landlord')).toMatchObject({
      author_is_owner: true, author_name: null });
  });

  it('lets the expert add a note that the owner can tell apart from their own entries', async () => {
    const note = await as(expert, 'post', `/api/matters/${matter.id}/events`).send({ description: 'Bring the lease to the meeting' });
    expect(note.status).toBe(201);
    expect(note.body.author_is_owner).toBe(false);
    const detail = await as(owner, 'get', `/api/matters/${matter.id}`);
    expect(detail.body.events.find((e) => e.description === 'Bring the lease to the meeting')).toMatchObject({
      author_is_owner: false, author_name: 'Test legal_expert' });
  });

  it('does not let the expert change or erase the matter', async () => {
    expect((await as(expert, 'put', `/api/matters/${matter.id}`).send({ title: 'Changed' })).status).toBe(403);
    expect((await as(expert, 'delete', `/api/matters/${matter.id}`)).status).toBe(403);
    const [row] = await q('SELECT title FROM matters WHERE id = $1', [matter.id]);
    expect(row.title).toBe('Deposit matter');
  });

  it('keeps another expert out', async () => {
    expect((await as(otherExpert, 'get', `/api/matters/${matter.id}`)).status).toBe(404);
    const res = await as(otherExpert, 'post', `/api/matters/${matter.id}/events`).send({ description: 'Let me in' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/matters/:id/share', () => {
  it('ends the expert’s access on their very next request', async () => {
    await share(owner, matter.id, entry.id);
    expect((await as(expert, 'get', `/api/matters/${matter.id}`)).status).toBe(200);
    const res = await unshare(owner, matter.id);
    expect(res.status).toBe(200);
    expect(res.body.shared_with).toBeNull();
    expect((await as(expert, 'get', `/api/matters/${matter.id}`)).status).toBe(404);
    expect((await as(expert, 'get', '/api/matters/shared')).body).toEqual([]);
    expect((await as(expert, 'post', `/api/matters/${matter.id}/events`).send({ description: 'x' })).status).toBe(404);
  });

  it('writes a line in the history', async () => {
    await share(owner, matter.id, entry.id);
    await unshare(owner, matter.id);
    const detail = await as(owner, 'get', `/api/matters/${matter.id}`);
    expect(detail.body.events.map((e) => e.description)).toContain('Stopped sharing with Expert Lawyer');
  });

  it('keeps the expert’s notes in the history after the share ends', async () => {
    await share(owner, matter.id, entry.id);
    await as(expert, 'post', `/api/matters/${matter.id}/events`).send({ description: 'A note from the expert' });
    await unshare(owner, matter.id);
    const detail = await as(owner, 'get', `/api/matters/${matter.id}`);
    expect(detail.body.events.map((e) => e.description)).toContain('A note from the expert');
  });

  it('refuses when the matter is not shared and for somebody else’s matter', async () => {
    const notShared = await unshare(owner, matter.id);
    expect(notShared.status).toBe(400);
    expect(notShared.body.error).toMatch(/not shared/);
    await share(owner, matter.id, entry.id);
    expect((await unshare(other, matter.id)).status).toBe(404);
    expect((await as(expert, 'get', `/api/matters/${matter.id}`)).status).toBe(200);
  });

  it('is ended when the entry is no longer linked to the expert', async () => {
    await share(owner, matter.id, entry.id);
    await q('UPDATE providers SET user_id = NULL WHERE id = $1', [entry.id]);
    expect((await as(expert, 'get', `/api/matters/${matter.id}`)).status).toBe(404);
  });
});

describe('the database rules for sharing', () => {
  it('refuses a share with no time it started', async () => {
    await expect(q('UPDATE matters SET shared_with = $1 WHERE id = $2', [entry.id, matter.id]))
      .rejects.toThrow(/matters_check/);
  });

  it('clears the share when the entry is removed', async () => {
    await share(owner, matter.id, entry.id);
    await q('UPDATE matters SET shared_with = NULL, shared_at = NULL WHERE id = $1', [matter.id]);
    const [row] = await q('SELECT shared_with, shared_at FROM matters WHERE id = $1', [matter.id]);
    expect(row).toEqual({ shared_with: null, shared_at: null });
  });
});

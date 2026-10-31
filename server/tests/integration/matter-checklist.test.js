// A matter following a checklist. It shows which documents are still missing. The state of an item
// follows the file attached to it. "Ready" means every required item has a file a lawyer marked
// complete. It is a statement about those files. It is never a promise that an office will accept
// them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

const PDF = (text = 'doc') => Buffer.from(`%PDF-1.4\n${text}\n%%EOF`);

let dir;
let admin;
let student;
let other;
let expert;
let matter;
let checklist;

beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matter-checklist-')); });
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const as = (who, method, p) => request(app)[method](p).set('Authorization', who.auth);

beforeEach(async () => {
  process.env.DOCUMENT_KEY = 'ef'.repeat(32);
  process.env.DOCUMENTS_DIR = dir;
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
  await resetDb();
  admin = await makeUser('admin', 'admin@example.org');
  student = await makeUser('student', 'student@alustudent.com');
  other = await makeUser('student', 'other@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
  const lawyer = await makeProvider({ name: 'Adv. Amani', category: 'lawyer', type: 'pro_bono_lawyer' }, { verifiedBy: expert.user.id });
  await q('UPDATE providers SET user_id = $1 WHERE id = $2', [expert.user.id, lawyer.id]);

  // A published checklist with two required items and one optional.
  const created = (await as(admin, 'post', '/api/checklists').send({
    slug: 'buying-a-car', title: 'Buying a car',
    items: [
      { key: 'sale-agreement', name: 'Sale agreement' },
      { key: 'buyer-id', name: 'Your ID' },
      { key: 'ebm', name: 'EBM invoice', required: false },
    ],
  })).body;
  await as(admin, 'post', `/api/checklists/${created.id}/publish`).send({}).expect(200);
  checklist = created;

  matter = (await as(student, 'post', '/api/matters').send({ title: 'Buying a car' })).body;
  await as(student, 'post', `/api/matters/${matter.id}/share`).send({ provider_id: lawyer.id }).expect(200);
});

const follow = (id = checklist.id, user = student) => as(user, 'post', `/api/matters/${matter.id}/checklist`).send({ checklist_id: id });
const upload = (label, query = '', user = student) =>
  request(app).post(`/api/matters/${matter.id}/documents?label=${encodeURIComponent(label)}${query}`)
    .set('Authorization', user.auth).set('Content-Type', 'application/pdf').send(PDF(label));
const state = async (user = student) => (await as(user, 'get', `/api/matters/${matter.id}/documents/checklist`)).body;
const verdict = (id, status, note) => as(expert, 'put', `/api/matters/${matter.id}/documents/${id}/review`).send({ status, note });

describe('following a checklist', () => {
  it('only a published checklist can be followed', async () => {
    const draft = (await as(admin, 'post', '/api/checklists').send({ slug: 'a-draft', title: 'A draft', items: [{ key: 'a', name: 'A' }] })).body;
    expect((await follow(draft.id)).status).toBe(400);
    expect((await follow(99999)).status).toBe(400);
    expect((await follow('abc')).status).toBe(400);
  });

  it('only the owner follows or stops following', async () => {
    expect((await follow(checklist.id, other)).status).toBe(404);
    expect((await follow(checklist.id, expert)).status).toBe(403);
    await follow().expect(200);
    expect((await as(other, 'delete', `/api/matters/${matter.id}/checklist`)).status).toBe(404);
  });

  it('with no checklist the matter says there is none', async () => {
    expect(await state()).toEqual({ checklist: null, items: [], ready: false });
  });

  it('lists every item as missing at the start and ready is false', async () => {
    await follow().expect(200);
    const s = await state();
    expect(s.checklist).toMatchObject({ title: 'Buying a car', under_review: false });
    expect(s.items.map((i) => [i.key, i.state, i.document])).toEqual([
      ['sale-agreement', 'missing', null], ['buyer-id', 'missing', null], ['ebm', 'missing', null]]);
    expect(s.ready).toBe(false);
  });

  it('stopping keeps every document that was attached', async () => {
    await follow().expect(200);
    await upload('Sale agreement', '&item=sale-agreement').expect(201);
    await as(student, 'delete', `/api/matters/${matter.id}/checklist`).expect(200);
    expect(await q('SELECT id FROM matter_documents')).toHaveLength(1);
    expect((await state()).checklist).toBeNull();
  });
});

describe('a file answers an item', () => {
  beforeEach(async () => { await follow().expect(200); });

  it('shows the state of an item from its file, and a lawyer verdict moves it', async () => {
    const doc = (await upload('Sale agreement', '&item=sale-agreement')).body;
    expect((await state()).items[0].state).toBe('pending');
    await verdict(doc.id, 'complete').expect(200);
    expect((await state()).items[0].state).toBe('complete');
    await verdict(doc.id, 'needs_fix', 'The price is missing.').expect(200);
    expect((await state()).items[0].state).toBe('needs_fix');
  });

  it('ready needs every required item complete. An optional item left missing does not block it', async () => {
    const a = (await upload('Sale agreement', '&item=sale-agreement')).body;
    const b = (await upload('Your ID', '&item=buyer-id')).body;
    await verdict(a.id, 'complete').expect(200);
    expect((await state()).ready).toBe(false);
    await verdict(b.id, 'complete').expect(200);
    const s = await state();
    expect(s.ready).toBe(true);
    expect(s.items.find((i) => i.key === 'ebm').state).toBe('missing');
  });

  it('refuses a file for an item that is not on the checklist', async () => {
    const res = await upload('Passport', '&item=not-an-item');
    expect(res.status).toBe(400);
    expect(await q('SELECT id FROM matter_documents')).toHaveLength(0);
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it('refuses an item when the matter follows no checklist', async () => {
    await as(student, 'delete', `/api/matters/${matter.id}/checklist`).expect(200);
    expect((await upload('Sale agreement', '&item=sale-agreement')).status).toBe(400);
  });

  it('one file for each item. A second one is refused and a replacement stays on the item', async () => {
    const first = (await upload('Sale agreement', '&item=sale-agreement')).body;
    const second = await upload('Sale agreement again', '&item=sale-agreement');
    expect(second.status).toBe(400);
    expect(second.body.error).toMatch(/Replace it/);
    const replacement = (await upload('Sale agreement v2', `&replaces=${first.id}`)).body;
    expect(replacement.item_key).toBe('sale-agreement');
    expect((await state()).items[0].document.id).toBe(replacement.id);
  });

  it('a replacement starts again as pending. The old verdict does not follow the new file', async () => {
    const first = (await upload('Sale agreement', '&item=sale-agreement')).body;
    await verdict(first.id, 'complete').expect(200);
    await upload('Sale agreement v2', `&replaces=${first.id}`).expect(201);
    expect((await state()).items[0].state).toBe('pending');
  });

  it('the shared lawyer sees the same list as the owner', async () => {
    await upload('Sale agreement', '&item=sale-agreement').expect(201);
    expect(await state(expert)).toEqual(await state(student));
  });

  it('another student and a visitor cannot read the list', async () => {
    expect((await as(other, 'get', `/api/matters/${matter.id}/documents/checklist`)).status).toBe(404);
    expect((await request(app).get(`/api/matters/${matter.id}/documents/checklist`)).status).toBe(401);
  });
});

describe('a checklist that changes while matters follow it', () => {
  beforeEach(async () => { await follow().expect(200); });

  it('is hidden while an expert checks it again. The documents stay', async () => {
    await upload('Sale agreement', '&item=sale-agreement').expect(201);
    await as(admin, 'put', `/api/checklists/${checklist.id}`).send({ title: 'Buying a car in Kigali' }).expect(200);
    const s = await state();
    expect(s.checklist).toMatchObject({ under_review: true });
    expect(s.items).toEqual([]);
    expect(s.ready).toBe(false);
    expect(await q('SELECT id FROM matter_documents')).toHaveLength(1);
  });

  it('refuses a new file for an item while the checklist is being checked again', async () => {
    await as(admin, 'put', `/api/checklists/${checklist.id}`).send({ title: 'Changed' }).expect(200);
    expect((await upload('Sale agreement', '&item=sale-agreement')).status).toBe(400);
  });

  it('a checklist that is deleted never deletes a matter. It only stops being followed', async () => {
    await q('DELETE FROM document_checklists WHERE id = $1', [checklist.id]);
    expect((await q('SELECT checklist_id FROM matters WHERE id = $1', [matter.id]))[0].checklist_id).toBeNull();
    expect((await state()).checklist).toBeNull();
  });
});

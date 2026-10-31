// Documents attached to a matter.
//
// These are passports, IDs and contracts. They are the most sensitive bytes the platform will ever
// hold. So the tests are an access matrix first and a feature second. Every role that must not see
// a file gets a 404 and never a 403. The route must not confirm that the file exists. And the file
// on disk is shown to be unreadable without the key.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, makeProvider } from '../helpers.js';

const KEY = 'ab'.repeat(32); // 64 hex characters is 32 bytes
const MARKER = 'SECRET-PASSPORT-NUMBER-RW123456';
const PDF = Buffer.from(`%PDF-1.4\n${MARKER}\n%%EOF`);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png-body')]);

let dir;
let student;
let other;
let expert;
let stranger;
let admin;
let lawyer;

beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matter-docs-')); });
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

beforeEach(async () => {
  process.env.DOCUMENT_KEY = KEY;
  process.env.DOCUMENTS_DIR = dir;
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
  await resetDb();
  student = await makeUser('student', 'student@alustudent.com');
  other = await makeUser('student', 'other@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
  stranger = await makeUser('legal_expert', 'stranger@example.org');
  admin = await makeUser('admin', 'admin@example.org');
  lawyer = await makeProvider({ name: 'Adv. Amani', category: 'lawyer', type: 'pro_bono_lawyer' }, { verifiedBy: expert.user.id });
  await q('UPDATE providers SET user_id = $1 WHERE id = $2', [expert.user.id, lawyer.id]);
});

const newMatter = async (user = student) =>
  (await request(app).post('/api/matters').set('Authorization', user.auth).send({ title: 'Buying a car' })).body;
const share = (id) =>
  request(app).post(`/api/matters/${id}/share`).set('Authorization', student.auth).send({ provider_id: lawyer.id });
const upload = (id, body = PDF, { label = 'Passport', type = 'application/pdf', user = student } = {}) =>
  request(app).post(`/api/matters/${id}/documents?label=${encodeURIComponent(label)}`)
    .set('Authorization', user.auth).set('Content-Type', type).send(body);
const list = (id, user = student) => request(app).get(`/api/matters/${id}/documents`).set('Authorization', user.auth);
const file = (id, doc, user = student) => request(app).get(`/api/matters/${id}/documents/${doc}/file`).set('Authorization', user.auth);
const remove = (id, doc, user = student) => request(app).delete(`/api/matters/${id}/documents/${doc}`).set('Authorization', user.auth);
const rows = async () => q('SELECT * FROM matter_documents ORDER BY id');

describe('uploading', () => {
  it('stores the document and sends back only what the page needs', async () => {
    const m = await newMatter();
    const res = await upload(m.id);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ label: 'Passport', mime: 'application/pdf', size_bytes: PDF.length });
    expect(res.body.review).toMatchObject({ status: 'pending' });
    for (const secret of ['stored_name', 'iv', 'auth_tag', 'sha256']) expect(res.body).not.toHaveProperty(secret);
  });

  it('the file on disk is encrypted. The plain text is nowhere in it', async () => {
    const m = await newMatter();
    await upload(m.id);
    const files = fs.readdirSync(dir);
    expect(files).toHaveLength(1);
    const onDisk = fs.readFileSync(path.join(dir, files[0]));
    expect(onDisk.includes(Buffer.from(MARKER))).toBe(false);
    // A random name with no label and no original name in it.
    expect(files[0]).toMatch(/^[a-f0-9]{32}$/);
  });

  it('the owner gets the exact bytes back as an attachment that is never cached or sniffed', async () => {
    const m = await newMatter();
    const doc = (await upload(m.id)).body;
    const res = await file(m.id, doc.id).buffer(true).parse((r, cb) => {
      const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(Buffer.compare(res.body, PDF)).toBe(0);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="document-${doc.id}.pdf"`);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('reads the type from the bytes. A web page labelled as a PDF is refused', async () => {
    const m = await newMatter();
    const res = await upload(m.id, Buffer.from('<html><script>alert(1)</script></html>'), { type: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(await rows()).toHaveLength(0);
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it('a PNG is stored as a PNG', async () => {
    const m = await newMatter();
    const res = await upload(m.id, PNG, { type: 'image/png', label: 'Photo' });
    expect(res.status).toBe(201);
    expect(res.body.mime).toBe('image/png');
  });

  it('needs a label and bounds it', async () => {
    const m = await newMatter();
    expect((await upload(m.id, PDF, { label: '   ' })).status).toBe(400);
    expect((await upload(m.id, PDF, { label: 'x'.repeat(121) })).status).toBe(400);
    expect((await upload(m.id, PDF, { label: 'x'.repeat(120) })).status).toBe(201);
  });

  it('refuses a file over 10 MB with the standard too large message', async () => {
    const m = await newMatter();
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10 * 1024 * 1024 + 10, 1)]);
    const res = await upload(m.id, big);
    expect(res.status).toBe(413);
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it('a matter holds at most 25 documents', async () => {
    const m = await newMatter();
    for (let i = 0; i < 25; i += 1) await upload(m.id, PDF, { label: `Doc ${i}` }).expect(201);
    const res = await upload(m.id, PDF, { label: 'One too many' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/up to 25 documents/);
    expect(fs.readdirSync(dir)).toHaveLength(25); // the refused file was not left behind
  });

  it('keeps at most 100 documents for one person across all their matters', async () => {
    const first = await newMatter();
    const second = await newMatter();
    // 100 rows directly. Uploading them one at a time would only test the speed of the disk.
    for (let i = 0; i < 100; i += 1) {
      const m = i < 50 ? first : second;
      await q(
        `INSERT INTO matter_documents (matter_id, label, stored_name, mime, size_bytes, sha256, iv, auth_tag)
         VALUES ($1,$2,$3,'application/pdf',10,'x','y','z')`, [m.id, `Doc ${i}`, i.toString(16).padStart(32, '0')]);
    }
    const third = await newMatter();
    const res = await upload(third.id);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/up to 100 documents in total/);
  });

  it('FAILS CLOSED. With no key nothing is stored and the page is told uploads are off', async () => {
    const m = await newMatter();
    process.env.DOCUMENT_KEY = '';
    const res = await upload(m.id);
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not switched on/);
    expect(await rows()).toHaveLength(0);
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it('a key of the wrong length counts as no key', async () => {
    const m = await newMatter();
    process.env.DOCUMENT_KEY = 'abcd';
    expect((await upload(m.id)).status).toBe(503);
    process.env.DOCUMENT_KEY = 'zz'.repeat(32); // right length but not hex
    expect((await upload(m.id)).status).toBe(503);
  });

  it('a closed matter takes no new documents', async () => {
    const m = await newMatter();
    await request(app).put(`/api/matters/${m.id}`).set('Authorization', student.auth).send({ status: 'closed' }).expect(200);
    const res = await upload(m.id);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/closed/);
  });

  it('is counted for each account. One person using up their uploads does not stop another', async () => {
    process.env.RATE_LIMIT_TEST = '1';
    try {
      const mine = await newMatter();
      const theirs = await newMatter(other);
      let last;
      for (let i = 0; i < 61; i += 1) last = await upload(mine.id, PNG, { type: 'image/png', label: `P${i}` });
      expect(last.status).toBe(429);
      expect(last.body.error).toMatch(/Too many uploads/);
      expect((await upload(theirs.id, PNG, { type: 'image/png', user: other })).status).toBe(201);
    } finally {
      delete process.env.RATE_LIMIT_TEST;
    }
  }, 60000);
});

describe('who can see a document. A 404 and never a 403', () => {
  let m;
  let doc;
  beforeEach(async () => {
    m = await newMatter();
    doc = (await upload(m.id)).body;
  });

  it('another student cannot list, download or delete it', async () => {
    expect((await list(m.id, other)).status).toBe(404);
    expect((await file(m.id, doc.id, other)).status).toBe(404);
    expect((await remove(m.id, doc.id, other)).status).toBe(404);
    expect(await rows()).toHaveLength(1);
  });

  it('a lawyer the matter is not shared with sees nothing', async () => {
    await share(m.id).expect(200);
    expect((await list(m.id, stranger)).status).toBe(404);
    expect((await file(m.id, doc.id, stranger)).status).toBe(404);
  });

  it('an admin has no way in either', async () => {
    expect((await list(m.id, admin)).status).toBe(403); // the role is not allowed on this route at all
    expect((await file(m.id, doc.id, admin)).status).toBe(403);
    expect((await remove(m.id, doc.id, admin)).status).toBe(403);
  });

  it('a visitor with no sign in is turned away', async () => {
    expect((await request(app).get(`/api/matters/${m.id}/documents`)).status).toBe(401);
    expect((await request(app).get(`/api/matters/${m.id}/documents/${doc.id}/file`)).status).toBe(401);
  });

  it('the shared lawyer can list and read but cannot upload or delete', async () => {
    await share(m.id).expect(200);
    const seen = await list(m.id, expert);
    expect(seen.status).toBe(200);
    expect(seen.body).toHaveLength(1);
    expect((await file(m.id, doc.id, expert)).status).toBe(200);
    expect((await upload(m.id, PDF, { user: expert })).status).toBe(404);
    expect((await remove(m.id, doc.id, expert)).status).toBe(404);
    expect(await rows()).toHaveLength(1);
  });

  it('stopping the share ends the access of the lawyer on the very next request', async () => {
    await share(m.id).expect(200);
    expect((await list(m.id, expert)).status).toBe(200);
    await request(app).delete(`/api/matters/${m.id}/share`).set('Authorization', student.auth).expect(200);
    expect((await list(m.id, expert)).status).toBe(404);
    expect((await file(m.id, doc.id, expert)).status).toBe(404);
  });

  it('a document id from another matter cannot be reached through this one', async () => {
    const mine = await newMatter(other);
    const theirs = (await upload(mine.id, PDF, { user: other, label: 'Theirs' })).body;
    expect((await file(m.id, theirs.id)).status).toBe(404);
    expect((await remove(m.id, theirs.id)).status).toBe(404);
    expect(await rows()).toHaveLength(2);
  });

  it('a malformed id is a plain 404', async () => {
    expect((await list('abc')).status).toBe(404);
    expect((await file(m.id, 'abc')).status).toBe(404);
    expect((await file(m.id, 99999)).status).toBe(404);
  });
});

describe('removing documents', () => {
  it('deleting a document removes the row and the file', async () => {
    const m = await newMatter();
    const doc = (await upload(m.id)).body;
    expect((await remove(m.id, doc.id)).status).toBe(204);
    expect(await rows()).toHaveLength(0);
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it('deleting the matter removes every file it held', async () => {
    const m = await newMatter();
    await upload(m.id, PDF, { label: 'One' });
    await upload(m.id, PNG, { type: 'image/png', label: 'Two' });
    expect(fs.readdirSync(dir)).toHaveLength(2);
    await request(app).delete(`/api/matters/${m.id}`).set('Authorization', student.auth).expect(204);
    expect(fs.readdirSync(dir)).toHaveLength(0);
    expect(await rows()).toHaveLength(0);
  });
});

describe('only the owner ever deletes a matter or its documents', () => {
  let m;
  beforeEach(async () => {
    m = await newMatter();
    await upload(m.id);
    await share(m.id).expect(200);
  });
  const intact = async () => {
    expect(await rows()).toHaveLength(1);
    expect(fs.readdirSync(dir)).toHaveLength(1);
    expect((await q('SELECT id FROM matters WHERE id = $1', [m.id]))).toHaveLength(1);
  };

  it('closing a matter keeps the matter and its documents', async () => {
    await request(app).put(`/api/matters/${m.id}`).set('Authorization', student.auth).send({ status: 'closed' }).expect(200);
    await intact();
  });

  it('an admin switching off the account of the owner keeps everything', async () => {
    await request(app).post(`/api/admin/users/${student.user.id}/deactivate`).set('Authorization', admin.auth).expect(200);
    await intact();
  });

  it('an admin and the shared lawyer have no way to delete the matter', async () => {
    expect((await request(app).delete(`/api/matters/${m.id}`).set('Authorization', admin.auth)).status).toBe(403);
    expect((await request(app).delete(`/api/matters/${m.id}`).set('Authorization', expert.auth)).status).toBe(403);
    await intact();
  });

  it('stopping the share keeps the matter and its documents of the owner', async () => {
    await request(app).delete(`/api/matters/${m.id}/share`).set('Authorization', student.auth).expect(200);
    await intact();
  });
});

describe('the cap and the replace under load', () => {
  it('twelve uploads sent at once never go past 25 documents', async () => {
    const m = await newMatter();
    for (let i = 0; i < 20; i += 1) await q(
      `INSERT INTO matter_documents (matter_id, label, stored_name, mime, size_bytes, sha256, iv, auth_tag)
       VALUES ($1,$2,$3,'application/pdf',10,'x','y','z')`, [m.id, `Doc ${i}`, i.toString(16).padStart(32, '0')]);
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => upload(m.id, PDF, { label: `Burst ${i}` })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(5);
    expect(results.filter((r) => r.status === 400)).toHaveLength(7);
    expect(await rows()).toHaveLength(25);
    expect(fs.readdirSync(dir)).toHaveLength(5); // the seven refused files were cleaned up
  });

  it('two replaces of one document at the same moment give one winner', async () => {
    const m = await newMatter();
    const doc = (await upload(m.id)).body;
    const replace = (label) => request(app)
      .post(`/api/matters/${m.id}/documents?label=${label}&replaces=${doc.id}`)
      .set('Authorization', student.auth).set('Content-Type', 'application/pdf').send(PDF);
    const results = await Promise.all([replace('A'), replace('B')]);
    // One winner. The loser is told the document is gone. That is a 409 when it was already inside the
    // swap and a 400 when it looked a moment later. Either way nothing is stored twice.
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => [400, 409].includes(r.status))).toHaveLength(1);
    expect(await rows()).toHaveLength(1);
    expect(fs.readdirSync(dir)).toHaveLength(1);
  });
});

describe('tampering', () => {
  it('a file altered on disk is refused and not served. The server does not crash', async () => {
    const m = await newMatter();
    const doc = (await upload(m.id)).body;
    const [row] = await rows();
    fs.appendFileSync(path.join(dir, row.stored_name), 'tampered');
    const res = await file(m.id, doc.id);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Could not read that document/);
    expect(JSON.stringify(res.body)).not.toMatch(/auth|decrypt|tag/i);
    expect((await list(m.id)).status).toBe(200); // everything else still works
  });

  it('a file copied under the name of another document does not decrypt as that document', async () => {
    const m = await newMatter();
    const a = (await upload(m.id, PDF, { label: 'A' })).body;
    await upload(m.id, Buffer.from('%PDF-1.4\nOTHER FILE\n%%EOF'), { label: 'B' });
    const [rowA, rowB] = await rows();
    fs.copyFileSync(path.join(dir, rowB.stored_name), path.join(dir, rowA.stored_name));
    expect((await file(m.id, a.id)).status).toBe(500);
  });
});

describe('telling the lawyer that something is waiting', () => {
  // The lawyer's list of shared matters. A count and nothing else about the files.
  const shared = (user = expert) => request(app).get('/api/matters/shared').set('Authorization', user.auth);
  const check = (id, doc, status = 'complete') =>
    request(app).put(`/api/matters/${id}/documents/${doc}/review`).set('Authorization', expert.auth).send({ status });

  it('counts the files that wait for a check, so the lawyer need not open every matter', async () => {
    const m = await newMatter();
    await share(m.id);
    expect((await shared()).body[0].documents_waiting).toBe(0);

    const first = (await upload(m.id, PDF, { label: 'Passport' })).body;
    await upload(m.id, PNG, { label: 'Photo', type: 'image/png' });
    expect((await shared()).body[0].documents_waiting).toBe(2);

    await check(m.id, first.id);
    expect((await shared()).body[0].documents_waiting).toBe(1);
  });

  it('counts a replaced file as waiting again, because the new file is checked again', async () => {
    const m = await newMatter();
    await share(m.id);
    const doc = (await upload(m.id)).body;
    await check(m.id, doc.id);
    expect((await shared()).body[0].documents_waiting).toBe(0);
    await request(app).post(`/api/matters/${m.id}/documents?label=Passport&replaces=${doc.id}`)
      .set('Authorization', student.auth).set('Content-Type', 'application/pdf').send(PDF);
    expect((await shared()).body[0].documents_waiting).toBe(1);
  });

  it('shows nothing about a matter that is not shared with this lawyer', async () => {
    const m = await newMatter();
    await upload(m.id);
    expect((await shared()).body).toEqual([]);
    await share(m.id);
    expect((await shared(stranger)).body).toEqual([]);
  });

  it('is only a number. It carries no file name, no label and no owner', async () => {
    const m = await newMatter();
    await share(m.id);
    await upload(m.id, PDF, { label: 'Passport' });
    const row = (await shared()).body[0];
    expect(Object.keys(row).sort()).toEqual([
      'documents_waiting', 'id', 'next_action', 'next_due', 'route_title', 'shared_at', 'shared_with_name', 'status', 'title', 'updated_at',
    ]);
    expect(JSON.stringify(row)).not.toMatch(/Passport|student@alustudent\.com/);
  });
});

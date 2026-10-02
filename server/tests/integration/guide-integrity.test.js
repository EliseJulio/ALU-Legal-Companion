// The integrity rule: the assistant can only read verified text.
//
// The full cycle is tested here:
// create, submit, verify (chunks appear), edit (chunks are deleted), verify again (chunks return).
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser, guideBody, countChunks } from '../helpers.js';

let admin;
let expert;

beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin', 'admin@alustudent.com');
  expert = await makeUser('legal_expert', 'expert@example.org');
});

const create = (body = guideBody()) => request(app).post('/api/guides').set('Authorization', admin.auth).send(body);
const submit = (id) => request(app).post(`/api/guides/${id}/submit`).set('Authorization', admin.auth);
const verify = (id) => request(app).post(`/api/guides/${id}/verify`).set('Authorization', expert.auth);
const edit = (id, body = {}) => request(app).put(`/api/guides/${id}`).set('Authorization', admin.auth).send(body);

async function publishGuide() {
  const { body } = await create();
  await submit(body.id);
  expect((await verify(body.id)).status).toBe(200);
  return body.id;
}

describe('the integrity rule', () => {
  test('a draft and a guide waiting for review have no chunks', async () => {
    const { body } = await create();
    expect(await countChunks(body.id)).toBe(0);
    await submit(body.id);
    expect(await countChunks(body.id)).toBe(0);
  });

  test('verifying a guide publishes it and makes its chunks', async () => {
    const id = await publishGuide();

    const [guide] = await q('SELECT status, verified_by, verified_at FROM guides WHERE id = $1', [id]);
    expect(guide.status).toBe('published');
    expect(guide.verified_by).toBe(expert.user.id);
    expect(guide.verified_at).not.toBeNull();
    expect(await countChunks(id)).toBe(5);
  });

  test('the chunks hold the verified text, with the title and source law', async () => {
    const id = await publishGuide();
    const chunks = (await q('SELECT chunk_text FROM guide_chunks WHERE guide_id = $1', [id])).map((c) => c.chunk_text);
    expect(chunks.some((c) => c.includes(guideBody().law_says))).toBe(true);
    for (const chunk of chunks) {
      expect(chunk).toContain(guideBody().title);
      expect(chunk).toContain(guideBody().source_law);
    }
  });

  test('editing a published guide un-verifies it and deletes its chunks', async () => {
    const id = await publishGuide();
    expect(await countChunks(id)).toBeGreaterThan(0);

    const res = await edit(id, { your_rights: 'Revised text, not checked yet.' });
    expect(res.status).toBe(200);

    const [guide] = await q('SELECT status, verified_by, verified_at FROM guides WHERE id = $1', [id]);
    expect(guide.status).toBe('draft');
    expect(guide.verified_by).toBeNull();
    expect(guide.verified_at).toBeNull();
    expect(await countChunks(id)).toBe(0);
  });

  test('verifying again after an edit makes chunks from the new text', async () => {
    const id = await publishGuide();
    await edit(id, { your_rights: 'A new sentence about your rights.' });
    await submit(id);
    await verify(id);

    expect(await countChunks(id)).toBe(5); // not 10: there are no duplicates
    const chunks = (await q('SELECT chunk_text FROM guide_chunks WHERE guide_id = $1', [id])).map((c) => c.chunk_text);
    expect(chunks.some((c) => c.includes('A new sentence about your rights.'))).toBe(true);
    expect(chunks.some((c) => c.includes(guideBody().your_rights))).toBe(false);
  });

  test('an edit that is refused leaves the guide published with its chunks', async () => {
    const id = await publishGuide();
    const res = await edit(id, { domain: 'nonsense' });
    expect(res.status).toBe(400);
    expect(await countChunks(id)).toBe(5);
  });

  test('editing one guide does not touch the chunks of another', async () => {
    const first = await publishGuide();
    const { body: second } = await create(guideBody({ title: 'Another guide' }));
    await submit(second.id);
    await verify(second.id);

    await edit(first);
    expect(await countChunks(first)).toBe(0);
    expect(await countChunks(second.id)).toBe(5);
  });

  test('deleting a guide row removes its chunks too', async () => {
    const id = await publishGuide();
    await q('DELETE FROM guides WHERE id = $1', [id]);
    expect(await countChunks(id)).toBe(0);
  });
});

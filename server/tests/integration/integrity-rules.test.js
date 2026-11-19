import request from 'supertest';
import app from '../../src/app.js';
import { pool, q } from '../../src/db.js';
import { applyMigrations } from '../../src/migrator.js';
import { hashAnonToken } from '../../src/services/anonToken.js';
import { resetDb, makeUser, makeProvider, makeAvailability, kigaliSlot } from '../helpers.js';

const MIGRATION = '034_integrity_rules_and_token_hashes.sql';
const HEX64 = /^[0-9a-f]{64}$/;
const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

beforeEach(resetDb);

// Applies every migration that has no record yet. In a test schema that is only the ones removed below.
async function applyPending() {
  const client = await pool.connect();
  try {
    return await applyMigrations(client);
  } finally {
    client.release();
  }
}

// Runs migration 034 again on this private schema by removing its record first.
async function reapply034() {
  await q('DELETE FROM schema_migrations WHERE name = $1', [MIGRATION]);
  return applyPending();
}

describe('a published row must name its verifier', () => {
  it('rejects a published guide with no verifier, and accepts one with a verifier', async () => {
    const admin = await makeUser('admin');
    const base = `INTO guides (domain, title, situation, law_says, your_rights, steps, get_help, source_law, status`;
    await expect(q(
      `INSERT ${base}) VALUES ('employment','T','s','l','r','st','g','Law No. 1','published')`,
    )).rejects.toThrow(/guides_published_is_verified/);
    const [ok] = await q(
      `INSERT ${base}, verified_by, verified_at) VALUES ('employment','T','s','l','r','st','g','Law No. 1','published',$1,now())
       RETURNING id`, [admin.user.id]);
    expect(ok.id).toBeGreaterThan(0);
  });

  it('rejects a published directory entry with no verifier', async () => {
    await expect(q(
      `INSERT INTO providers (name, category, type, status) VALUES ('X','lawyer','pro_bono_lawyer','published')`,
    )).rejects.toThrow(/providers_published_is_verified/);
  });

  it('rejects a published matter route with no verifier', async () => {
    const [forum] = await q(
      `INSERT INTO providers (name, category, type) VALUES ('Forum','organisation','abunzi') RETURNING id`);
    await expect(q(
      `INSERT INTO matter_routes (matter_type, title, legal_basis, first_forum_id, status)
       VALUES ('t','T','Law No. 1',$1,'published')`, [forum.id],
    )).rejects.toThrow(/matter_routes_published_is_verified/);
  });

  it('rejects a published document checklist with no verifier', async () => {
    await expect(q(
      `INSERT INTO document_checklists (slug, title, items, status)
       VALUES ('x-checklist','X','[]','published')`,
    )).rejects.toThrow(/document_checklists_published_is_verified/);
  });
});

describe('anonymous codes are never stored in plain text', () => {
  it('stores a 64-character hash for every anonymous question and booking made through the API', async () => {
    const expert = await makeUser('legal_expert');
    const provider = await makeProvider(
      { name: 'Bookable Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', user_id: expert.user.id, bookable: true },
      { verifiedBy: expert.user.id });

    await makeAvailability(provider.id);
    const question = await request(app).post('/api/questions/anonymous')
      .send({ text: 'Is my supervisor allowed to do this?' });
    const booking = await request(app).post('/api/bookings/anonymous')
      .send({ provider_id: provider.id, slot: kigaliSlot(3), topic: 'My landlord kept my deposit' });
    expect(question.status).toBe(201);
    expect(booking.status).toBe(201);

    const rows = [
      ...(await q('SELECT anon_token FROM questions')),
      ...(await q('SELECT anon_token FROM bookings')),
    ];
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.anon_token).toMatch(HEX64);
    // The code the person was given is not what is stored.
    expect(rows.map((r) => r.anon_token)).toEqual(
      expect.arrayContaining([hashAnonToken(question.body.anon_token), hashAnonToken(booking.body.anon_token)]));
  });
});

describe('migration 034', () => {
  it('hashes an old plain-text code the way the application does, and leaves a hash alone', async () => {
    const plainQuestion = 'ABCDEFGHJKMNPQ'; // 14 characters, the old format
    const plainBooking = 'RSTVWXYZ234567'; // 14 characters, the old format
    const alreadyHashed = hashAnonToken('ZZZZ-ZZZZ-ZZZZ-ZZZZ');
    const expert = await makeUser('legal_expert');
    const provider = await makeProvider(
      { name: 'Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', user_id: expert.user.id, bookable: true },
      { verifiedBy: expert.user.id });
    await q(`INSERT INTO questions (anon_token, text) VALUES ($1,'plain'), ($2,'hashed')`, [plainQuestion, alreadyHashed]);
    await q(`INSERT INTO bookings (anon_token, provider_id, slot) VALUES ($1,$2, now() + interval '3 days')`,
      [plainBooking, provider.id]);

    const applied = await reapply034();
    expect(applied).toEqual([MIGRATION]);

    const [question] = await q(`SELECT anon_token FROM questions WHERE text = 'plain'`);
    const [booking] = await q('SELECT anon_token FROM bookings');
    const [kept] = await q(`SELECT anon_token FROM questions WHERE text = 'hashed'`);
    expect(question.anon_token).toBe(hashAnonToken(plainQuestion));
    expect(booking.anon_token).toBe(hashAnonToken(plainBooking));
    expect(kept.anon_token).toBe(alreadyHashed);
  });

  it('restores a missing published rule, and refuses to add it over an unverified published row', async () => {
    try {
      await q('ALTER TABLE guides DROP CONSTRAINT guides_published_is_verified');
      await q(`INSERT INTO guides (domain, title, situation, law_says, your_rights, steps, get_help, source_law, status)
               VALUES ('employment','Unverified','s','l','r','st','g','Law No. 1','published')`);

      await expect(reapply034()).rejects.toThrow(/published row\(s\) have no verifier/);
      const [still] = await q(`SELECT status, verified_by FROM guides WHERE title = 'Unverified'`);
      expect(still).toEqual({ status: 'published', verified_by: null });
      const [absent] = await q(
        `SELECT 1 FROM pg_constraint WHERE conrelid = 'guides'::regclass AND conname = 'guides_published_is_verified'`);
      expect(absent).toBeUndefined();

      await q(`DELETE FROM guides WHERE title = 'Unverified'`);
      expect(await reapply034()).toEqual([MIGRATION]);
      const [restored] = await q(
        `SELECT 1 FROM pg_constraint WHERE conrelid = 'guides'::regclass AND conname = 'guides_published_is_verified'`);
      expect(restored).toBeDefined();
    } finally {
      // Puts the schema back whatever happened above, so later tests see every rule.
      await q(`DELETE FROM guides WHERE title = 'Unverified'`);
      await applyPending();
      const [present] = await q(`SELECT 1 FROM pg_constraint WHERE conrelid = 'guides'::regclass AND conname = 'guides_published_is_verified'`);
      if (!present) {
        await q(`ALTER TABLE guides ADD CONSTRAINT guides_published_is_verified
                 CHECK (status <> 'published' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))`);
      }
    }
  });
});

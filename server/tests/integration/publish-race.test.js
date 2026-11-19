import request from 'supertest';
import app from '../../src/app.js';
import { q, pool } from '../../src/db.js';
import { resetDb, makeUser, makeProvider, makeRoute } from '../helpers.js';

// Each record type publishes only the version that was checked. An edit that lands between the
// check and the publish must make the publish answer 409 and leave the record as a draft.
let admin;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
});

const KINDS = [
  {
    name: 'checklist',
    table: 'document_checklists',
    path: (id) => `/api/checklists/${id}/publish`,
    make: async () => (await q(
      `INSERT INTO document_checklists (slug, title, items, status)
       VALUES ('race-checklist', 'Race checklist', '[]'::jsonb, 'draft') RETURNING id`))[0].id,
  },
  {
    name: 'route',
    table: 'matter_routes',
    path: (id) => `/api/directory/routes/${id}/publish`,
    make: async () => (await makeRoute((await makeProvider({ name: 'Race entry' })).id)).id,
  },
  {
    name: 'dispute ladder step',
    table: 'dispute_ladder_steps',
    path: (id) => `/api/directory/ladder/${id}/publish`,
    make: async () => (await q(
      `INSERT INTO dispute_ladder_steps (position, title, tagline, description, law_cited)
       VALUES (1, 'Race step', 't', 'd', '') RETURNING id`))[0].id,
  },
  {
    name: 'directory entry',
    table: 'providers',
    path: (id) => `/api/directory/providers/${id}/publish`,
    make: async () => (await makeProvider({ name: 'Race entry' })).id,
  },
];

describe.each(KINDS)('publishing a $name that changed after it was checked', ({ table, path, make }) => {
  it('answers 409 and leaves the record a draft', async () => {
    const id = await make();
    const holder = await pool.connect();
    try {
      // The holder locks the row. The publish reads the clean version and then waits for the lock.
      await holder.query('BEGIN');
      await holder.query(`UPDATE ${table} SET updated_at = updated_at WHERE id = $1`, [id]);
      const pending = request(app).post(path(id)).set('Authorization', admin.auth).then((r) => r);
      let waiting = false;
      for (let i = 0; i < 250 && !waiting; i += 1) {
        const { rows } = await pool.query(
          `SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE $1`, [`%UPDATE ${table}%`]);
        waiting = rows.length > 0;
        if (!waiting) await new Promise((r) => { setTimeout(r, 20); });
      }
      expect(waiting).toBe(true);
      // An edit lands and stamps a new time, as an admin's edit does.
      await holder.query(`UPDATE ${table} SET updated_at = now() WHERE id = $1`, [id]);
      await holder.query('COMMIT');
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('That record was just changed. Reload and try again.');
    } finally {
      holder.release();
    }
    const [row] = await q(`SELECT status FROM ${table} WHERE id = $1`, [id]);
    expect(row.status).toBe('draft');
  });
});

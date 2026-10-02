// Applies the SQL files in src/migrations in name order each exactly once.
//
// Each file runs in its own transaction and is recorded in schema_migrations when it succeeds
// so a failed migration leaves nothing half-applied and a second run does nothing. The schema
// is built one feature at a time: a new feature adds a new numbered file and never edits an
// old one.
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, 'migrations');

// `client` is a single pg client (not the pool): BEGIN and COMMIT must share a connection.
// Returns the names of the migrations applied by this call.
export async function runMigrations(client, dir = MIGRATIONS_DIR) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));

  const applied = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      err.message = `${file}: ${err.message}`;
      throw err;
    }
    applied.push(file);
  }
  return applied;
}

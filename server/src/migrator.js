// Applies the numbered .sql files in src/migrations in order. Each file runs once.
// The names of the files already applied are kept in the schema_migrations table.
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, 'migrations');

// `client` is one open connection and not a pool. This way BEGIN and COMMIT reach the same session.
// Returns the names of the files it applied. Running it again applies nothing.
export async function applyMigrations(client, dir = MIGRATIONS_DIR) {
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`);
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    // One file is all or nothing. A failure halfway leaves no half-made tables behind.
    await client.query('BEGIN');
    try {
      await client.query(readFileSync(join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      err.message = `${file}: ${err.message}`;
      throw err;
    }
  }
  return applied;
}

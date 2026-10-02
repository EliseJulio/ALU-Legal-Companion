// Applies any migrations not yet applied. run: npm run migrate
import { pool } from './db.js';
import { runMigrations } from './migrator.js';

const client = await pool.connect();
try {
  const applied = await runMigrations(client);
  console.log(applied.length ? `✓ applied: ${applied.join(', ')}` : '✓ database already up to date');
} catch (err) {
  console.error('✗ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

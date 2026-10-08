// Applies the database migrations. Usage: npm run migrate
import { pool } from './db.js';
import { applyMigrations } from './migrator.js';

const client = await pool.connect();
try {
  const applied = await applyMigrations(client);
  console.log(applied.length ? `✓ applied: ${applied.join(', ')}` : '✓ nothing new to apply');
} catch (err) {
  console.error('✗ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

// Database connection (PostgreSQL)
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  application_name: process.env.PGAPPNAME || 'alu-legal-server',
});

// Small helper so routes can write: const rows = await q('SELECT ...', [x])
export async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows;
}

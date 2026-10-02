// Database connection (PostgreSQL)
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Only the test setup sets this. It points the connections at the schema made for that test run.
const testSchema = process.env.ALU_TEST_SCHEMA;

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  application_name: process.env.PGAPPNAME || 'alu-legal-server',
  ...(testSchema ? { options: `-c search_path=${testSchema},public` } : {}),
});

// A small helper so a route can write: const rows = await q('SELECT ...', [x])
export async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows;
}

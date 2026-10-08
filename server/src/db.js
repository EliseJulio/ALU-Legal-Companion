// Database connection (PostgreSQL)
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Only the test setup sets this. It points every connection at the schema made for that test run.
const testSchema = process.env.ALU_TEST_SCHEMA;

// A DATE column comes back as a plain string like '2026-09-21' and not as a JavaScript Date.
// A Date is shifted by the time zone and a legal date one day out is a wrong answer.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ...(testSchema ? { options: `-c search_path=${testSchema}` } : {}),
});

// A small helper so a route can write: const rows = await q('SELECT ...', [x])
export async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows;
}

// Gives each test run its own private schema and applies the migrations into it.
//
// Why: most integration tests empty every table first. If two runs shared one set of tables
// (an IDE test runner beside a terminal does this) one run would wipe rows the other is
// checking. The failures looked random. With a schema per run the two cannot see each other.
import pg from 'pg';
import { applyMigrations } from '../src/migrator.js';

export default async function globalSetup() {
  const connectionString = process.env.TEST_DATABASE_URL
    || `postgres://alu:${process.env.PGPASSWORD || 'alu_dev'}@localhost:5432/alu_legal_test`;

  // The name is used as an SQL identifier. It is built only from our own process id and the
  // time, never from anything a caller supplies.
  const schema = `test_${process.pid}_${Date.now().toString(36)}`;

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await applyMigrations(client);
  } finally {
    await client.end();
  }

  // Jest starts its workers after this returns and they inherit this environment.
  // That is how db.js learns which schema to use. globalTeardown reads the global to drop it.
  process.env.ALU_TEST_SCHEMA = schema;
  globalThis.__ALU_TEST_SCHEMA__ = schema;
}

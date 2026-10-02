// Gives each test run its own private schema (a separate set of tables) and builds the tables
// with the real migrations.
//
// Why: the tests empty the tables they use. If two runs shared the same tables, one run could
// wipe the rows the other is using. With a schema each, they cannot affect each other.
import pg from 'pg';
import { runMigrations } from '../src/migrator.js';

export default async function globalSetup() {
  const connectionString = process.env.TEST_DATABASE_URL
    || 'postgres://alu:alu_dev@localhost:5432/alu_legal_test';
  // The name is built from the process id and the time. A schema name cannot be passed as a
  // query value so it must only ever be made from safe parts like these.
  const schema = `test_${process.pid}_${Date.now().toString(36)}`;

  const client = new pg.Client({ connectionString, application_name: 'alu-test-globalsetup' });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await runMigrations(client);
  } finally {
    await client.end();
  }

  // Jest starts its workers after this. They get this variable and db.js reads it.
  process.env.ALU_TEST_SCHEMA = schema;
  globalThis.__ALU_TEST_SCHEMA__ = schema;
}

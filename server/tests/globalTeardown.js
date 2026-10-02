// Drops the private schema that globalSetup made for this run.
//
// This must never throw. If cleanup fails, Jest reports the whole run as failed and hides the
// real test results. A schema left behind is harmless, it only holds empty tables.
import pg from 'pg';

export default async function globalTeardown() {
  const schema = globalThis.__ALU_TEST_SCHEMA__ || process.env.ALU_TEST_SCHEMA;
  globalThis.__ALU_TEST_SCHEMA__ = undefined;
  if (!schema) return;

  const connectionString = process.env.TEST_DATABASE_URL
    || 'postgres://alu:alu_dev@localhost:5432/alu_legal_test';
  let client;
  try {
    client = new pg.Client({ connectionString, application_name: 'alu-test-teardown' });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  } catch {
    // Ignore the error. See above.
  } finally {
    try {
      await client?.end();
    } catch { /* already closed */ }
  }
}

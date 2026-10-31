// Drops the private schema that globalSetup made for this run.
//
// Nothing in here may throw. Jest counts an error in teardown as a failed run, so a cleanup
// problem would turn a green suite red. A schema that is left behind is harmless.
import pg from 'pg';

export default async function globalTeardown() {
  const schema = globalThis.__ALU_TEST_SCHEMA__ || process.env.ALU_TEST_SCHEMA;
  globalThis.__ALU_TEST_SCHEMA__ = undefined;
  if (!schema) return;

  const connectionString = process.env.TEST_DATABASE_URL
    || 'postgres://alu:alu_dev@localhost:5432/alu_legal_test';
  let client;
  try {
    client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  } catch {
    // Leave it. The result of the run matters more than tidying up.
  } finally {
    try {
      await client?.end();
    } catch { /* the connection is already gone */ }
  }
}

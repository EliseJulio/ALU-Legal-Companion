// The migration runner and the first migration run against a real PostgreSQL.
//
// Each run works in its own private schema so it cannot touch a developer's data and two runs
// cannot interfere with each other. Needs a database named like a test database:
//   createdb alu_legal_test
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import pg from 'pg';
import { runMigrations } from '../src/migrator.js';

const url = process.env.TEST_DATABASE_URL || 'postgres://alu:alu_dev@localhost:5432/alu_legal_test';
const schema = `mig_${process.pid}_${Date.now().toString(36)}`;
let client;

beforeAll(async () => {
  client = new pg.Client({ connectionString: url, application_name: 'alu-test-migrations' });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
});

afterAll(async () => {
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await client.end();
});

const tableExists = async (name) =>
  (await client.query('SELECT to_regclass($1) AS t', [name])).rows[0].t !== null;

describe('runMigrations', () => {
  test('builds the schema from nothing', async () => {
    const applied = await runMigrations(client);
    expect(applied).toContain('001_users.sql');
    expect(await tableExists('users')).toBe(true);
    expect(await tableExists('schema_migrations')).toBe(true);
  });

  test('a second run applies nothing', async () => {
    expect(await runMigrations(client)).toEqual([]);
  });

  test('a failing migration rolls back and is not recorded', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'alu-mig-'));
    writeFileSync(join(dir, '001_bad.sql'), 'CREATE TABLE half_done (id INT); SELECT nope FROM nowhere;');
    await expect(runMigrations(client, dir)).rejects.toThrow(/001_bad\.sql/);
    expect(await tableExists('half_done')).toBe(false);
    const rows = (await client.query("SELECT 1 FROM schema_migrations WHERE name = '001_bad.sql'")).rows;
    expect(rows).toHaveLength(0);
  });
});

describe('users table', () => {
  const insert = (email, role) => client.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    ['Test', email, 'hash', role],
  );

  test('accepts the four roles', async () => {
    for (const role of ['student', 'staff', 'legal_expert', 'admin']) {
      await insert(`${role}@example.org`, role);
    }
    const { rows } = await client.query('SELECT count(*)::int AS n FROM users');
    expect(rows[0].n).toBe(4);
  });

  test('rejects an unknown role', async () => {
    await expect(insert('x@example.org', 'superuser')).rejects.toThrow(/users_role_check/);
  });

  test('rejects a duplicate email', async () => {
    await expect(insert('student@example.org', 'student')).rejects.toThrow(/users_email_key/);
  });
});

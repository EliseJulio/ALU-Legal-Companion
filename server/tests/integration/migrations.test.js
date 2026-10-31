import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pool, q } from '../../src/db.js';
import { applyMigrations, MIGRATIONS_DIR } from '../../src/migrator.js';
import { resetDb, makeUser } from '../helpers.js';

beforeEach(resetDb);

describe('migrations', () => {
  it('records every file as applied', async () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    const rows = await q('SELECT name FROM schema_migrations ORDER BY name');
    expect(rows.map((r) => r.name)).toEqual(files);
  });

  it('applies nothing the second time', async () => {
    const client = await pool.connect();
    try {
      expect(await applyMigrations(client)).toEqual([]);
    } finally {
      client.release();
    }
  });

  it('keeps the list of applied migrations when the tables are emptied', async () => {
    const [{ n }] = await q('SELECT count(*)::int AS n FROM schema_migrations');
    expect(n).toBeGreaterThan(0);
  });

  it('undoes a file that fails halfway', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'alu-migrations-'));
    writeFileSync(join(dir, '900_bad.sql'), 'CREATE TABLE half_made (id INT); SELECT nothing_here;');
    const client = await pool.connect();
    try {
      await expect(applyMigrations(client, dir)).rejects.toThrow(/900_bad\.sql/);
    } finally {
      client.release();
      rmSync(dir, { recursive: true, force: true });
    }
    const [table] = await q("SELECT to_regclass('half_made') AS found");
    expect(table.found).toBeNull();
    const rows = await q("SELECT name FROM schema_migrations WHERE name = '900_bad.sql'");
    expect(rows).toHaveLength(0);
  });
});

describe('users table', () => {
  it('starts an account verified by the fixture and with session_version 0', async () => {
    const { user } = await makeUser('student');
    expect(user.session_version).toBe(0);
    expect(user.deactivated_at).toBeNull();
    expect(user.email_verified_at).not.toBeNull();
  });

  it('does not accept an unknown role', async () => {
    await expect(
      q(`INSERT INTO users (name, email, password_hash, role) VALUES ('X','x@example.org','h','owner')`),
    ).rejects.toThrow(/users_role_check/);
  });

  it('keeps one account for each email address', async () => {
    await makeUser('student', 'same@alustudent.com');
    await expect(makeUser('staff', 'same@alustudent.com')).rejects.toThrow(/users_email_key/);
  });
});

describe('auth_tokens table', () => {
  const insertToken = (userId, hash, purpose = 'verify_email') =>
    q(`INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at)
       VALUES ($1,$2,$3, now() + interval '1 hour')`, [userId, hash, purpose]);

  it('accepts the three purposes and refuses any other', async () => {
    const { user } = await makeUser('student');
    await insertToken(user.id, 'hash-one', 'verify_email');
    await insertToken(user.id, 'hash-two', 'reset_password');
    await insertToken(user.id, 'hash-three', 'change_email');
    await expect(insertToken(user.id, 'hash-four', 'something_else')).rejects.toThrow(/auth_tokens_purpose_check/);
  });

  it('never stores the same token hash twice', async () => {
    const { user } = await makeUser('student');
    await insertToken(user.id, 'same-hash');
    await expect(insertToken(user.id, 'same-hash')).rejects.toThrow(/auth_tokens_token_hash_key/);
  });

  it('removes a person’s tokens when the account is removed', async () => {
    const { user } = await makeUser('student');
    await insertToken(user.id, 'hash-one');
    await q('DELETE FROM users WHERE id = $1', [user.id]);
    const rows = await q('SELECT id FROM auth_tokens');
    expect(rows).toHaveLength(0);
  });
});

describe('dates', () => {
  it('come back from the database as plain strings', async () => {
    const [row] = await q("SELECT DATE '2026-09-21' AS day");
    expect(row.day).toBe('2026-09-21');
  });
});

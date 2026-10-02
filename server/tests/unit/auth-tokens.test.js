// One-time tokens for email links. These tests check the two rules that keep them safe: the
// real token is never saved and a token only works for its own purpose.
import { issueToken, consumeToken } from '../../src/services/authTokens.js';
import { q } from '../../src/db.js';

// Makes a throwaway user and returns its id.
async function makeUser(email) {
  const [u] = await q(
    `INSERT INTO users (name, email, password_hash, role) VALUES ('T', $1, 'x', 'student') RETURNING id`,
    [email]);
  return u.id;
}

describe('auth tokens', () => {
  test('a new token can be used once', async () => {
    const userId = await makeUser(`t1.${Date.now()}@alustudent.com`);
    const raw = await issueToken(userId, 'verify_email');
    expect(await consumeToken(raw, 'verify_email')).toMatchObject({ user_id: userId });
    // Using it again must fail, so a forwarded or replayed link does nothing.
    expect(await consumeToken(raw, 'verify_email')).toBeNull();
  });

  test('the real token is never saved', async () => {
    // If the database leaks, the saved rows must not work as links.
    const userId = await makeUser(`t2.${Date.now()}@alustudent.com`);
    const raw = await issueToken(userId, 'verify_email');
    const rows = await q('SELECT token_hash FROM auth_tokens WHERE user_id = $1', [userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toBe(raw);
    expect(rows[0].token_hash).not.toContain(raw);
  });

  test('an expired token is refused', async () => {
    const userId = await makeUser(`t3.${Date.now()}@alustudent.com`);
    const raw = await issueToken(userId, 'verify_email');
    await q(`UPDATE auth_tokens SET expires_at = now() - interval '1 hour' WHERE user_id = $1`, [userId]);
    expect(await consumeToken(raw, 'verify_email')).toBeNull();
  });

  test('a token made for one purpose does not work for another', async () => {
    const userId = await makeUser(`t4.${Date.now()}@alustudent.com`);
    const raw = await issueToken(userId, 'verify_email');
    expect(await consumeToken(raw, 'something_else')).toBeNull();
  });

  test('an unknown purpose is rejected when making a token', async () => {
    const userId = await makeUser(`t5.${Date.now()}@alustudent.com`);
    await expect(issueToken(userId, 'something_else')).rejects.toThrow(/Unknown token purpose/);
  });
});

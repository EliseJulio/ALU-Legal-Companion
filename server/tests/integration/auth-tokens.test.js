import crypto from 'node:crypto';
import { q } from '../../src/db.js';
import { issueToken, consumeToken, tokenStatus } from '../../src/services/authTokens.js';
import { resetDb, makeUser } from '../helpers.js';

beforeEach(resetDb);

describe('auth tokens', () => {
  it('stores only a hash and never the token itself', async () => {
    const { user } = await makeUser('student');
    const raw = await issueToken(user.id, 'verify_email');
    const [row] = await q('SELECT token_hash FROM auth_tokens');
    expect(row.token_hash).not.toBe(raw);
    expect(row.token_hash).toBe(crypto.createHash('sha256').update(raw).digest('hex'));
  });

  it('works once and then never again', async () => {
    const { user } = await makeUser('student');
    const raw = await issueToken(user.id, 'verify_email');
    const first = await consumeToken(raw, 'verify_email');
    expect(first.user_id).toBe(user.id);
    expect(await consumeToken(raw, 'verify_email')).toBeNull();
  });

  it('lets only one of several simultaneous uses through', async () => {
    const { user } = await makeUser('student');
    const raw = await issueToken(user.id, 'verify_email');
    const results = await Promise.all(Array.from({ length: 6 }, () => consumeToken(raw, 'verify_email')));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('does not work for a different purpose', async () => {
    const { user } = await makeUser('student');
    const raw = await issueToken(user.id, 'verify_email');
    expect(await consumeToken(raw, 'reset_password')).toBeNull();
    expect(await consumeToken(raw, 'verify_email')).not.toBeNull();
  });

  it('does not work after it expires', async () => {
    const { user } = await makeUser('student');
    const raw = await issueToken(user.id, 'verify_email');
    await q("UPDATE auth_tokens SET expires_at = now() - interval '1 minute'");
    expect(await consumeToken(raw, 'verify_email')).toBeNull();
  });

  it('refuses an unknown purpose and empty input', async () => {
    const { user } = await makeUser('student');
    await expect(issueToken(user.id, 'something_else')).rejects.toThrow(/Unknown token purpose/);
    expect(await consumeToken('', 'verify_email')).toBeNull();
    expect(await consumeToken('something', '')).toBeNull();
  });

  it('says why a token was refused', async () => {
    const { user } = await makeUser('student');
    const raw = await issueToken(user.id, 'verify_email');
    expect(await tokenStatus(raw, 'verify_email')).toBe('valid');
    expect(await tokenStatus(raw, 'reset_password')).toBe('unknown');
    expect(await tokenStatus('no-such-token', 'verify_email')).toBe('unknown');

    await consumeToken(raw, 'verify_email');
    expect(await tokenStatus(raw, 'verify_email')).toBe('used');

    const second = await issueToken(user.id, 'verify_email');
    await q("UPDATE auth_tokens SET expires_at = now() - interval '1 minute' WHERE used_at IS NULL");
    expect(await tokenStatus(second, 'verify_email')).toBe('expired');
  });
});

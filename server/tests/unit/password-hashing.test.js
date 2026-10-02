// The hashing strength is set in one place. Hashes made with a lower strength must still
// work, so raising it does not lock anyone out.
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../../src/middleware/auth.js';

describe('BCRYPT_ROUNDS', () => {
  test('is at least 12', () => {
    expect(BCRYPT_ROUNDS).toBeGreaterThanOrEqual(12);
  });

  test('a new hash starts with $2a$12$ or $2b$12$', async () => {
    const hash = await bcrypt.hash('password1234', BCRYPT_ROUNDS);
    expect(hash).toMatch(/^\$2[ab]\$12\$/);
  });

  test('a hash made at cost 10 still verifies', async () => {
    const oldHash = await bcrypt.hash('password1234', 10);
    expect(oldHash).toMatch(/^\$2[ab]\$10\$/);
    await expect(bcrypt.compare('password1234', oldHash)).resolves.toBe(true);
  });
});

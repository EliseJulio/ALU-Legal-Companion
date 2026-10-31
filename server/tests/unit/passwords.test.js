import { hashPassword, checkPassword, BCRYPT_ROUNDS } from '../../src/passwords.js';

describe('passwords', () => {
  it('never stores the password itself', async () => {
    const hash = await hashPassword('a-long-test-password');
    expect(hash).not.toContain('a-long-test-password');
  });

  it('accepts the right password and refuses a wrong one', async () => {
    const hash = await hashPassword('a-long-test-password');
    expect(await checkPassword('a-long-test-password', hash)).toBe(true);
    expect(await checkPassword('another-password', hash)).toBe(false);
  });

  it('saves the cost inside the hash so it can change later', async () => {
    const hash = await hashPassword('a-long-test-password');
    expect(hash.startsWith(`$2a$${BCRYPT_ROUNDS}$`)).toBe(true);
  });

  it('gives a different hash each time for the same password', async () => {
    const one = await hashPassword('a-long-test-password');
    const two = await hashPassword('a-long-test-password');
    expect(one).not.toBe(two);
  });
});

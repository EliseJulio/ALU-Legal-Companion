// A missing or weak JWT_SECRET must throw an error. A guessable fallback would let
// anyone make a fake token.
import { getSecret } from '../../src/middleware/auth.js';

const EXPECTED_MESSAGE =
  'JWT_SECRET must be set to a random string of at least 32 characters. ' +
  'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';

describe('getSecret', () => {
  let originalSecret;

  beforeEach(() => {
    originalSecret = process.env.JWT_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  test('throws when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    expect(() => getSecret()).toThrow(EXPECTED_MESSAGE);
  });

  test('throws when JWT_SECRET is empty', () => {
    process.env.JWT_SECRET = '';
    expect(() => getSecret()).toThrow(EXPECTED_MESSAGE);
  });

  test("throws when JWT_SECRET is 'dev-secret'", () => {
    process.env.JWT_SECRET = 'dev-secret';
    expect(() => getSecret()).toThrow(EXPECTED_MESSAGE);
  });

  test("throws when JWT_SECRET is 'change-me-in-production'", () => {
    process.env.JWT_SECRET = 'change-me-in-production';
    expect(() => getSecret()).toThrow(EXPECTED_MESSAGE);
  });

  test('throws when JWT_SECRET is 31 characters', () => {
    process.env.JWT_SECRET = 'a'.repeat(31);
    expect(() => getSecret()).toThrow(EXPECTED_MESSAGE);
  });

  test('returns the value when JWT_SECRET is 32 characters', () => {
    const secret = 'a'.repeat(32);
    process.env.JWT_SECRET = secret;
    expect(getSecret()).toBe(secret);
  });

  test('returns the value when JWT_SECRET is longer than 32 characters', () => {
    const secret = 'a'.repeat(64);
    process.env.JWT_SECRET = secret;
    expect(getSecret()).toBe(secret);
  });
});

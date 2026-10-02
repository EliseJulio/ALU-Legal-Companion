// Only people with an ALU email can sign up.
import { isAllowedEmail, normalizeEmail, ALLOWED_DOMAINS } from '../../src/middleware/auth.js';

describe('isAllowedEmail', () => {
  test('accepts both ALU domains', () => {
    expect(isAllowedEmail('e.hakizimana@alustudent.com')).toBe(true);
    expect(isAllowedEmail('faculty@alueducation.com')).toBe(true);
  });

  test('rejects domains outside the community', () => {
    expect(isAllowedEmail('someone@gmail.com')).toBe(false);
    expect(isAllowedEmail('someone@yahoo.fr')).toBe(false);
  });

  test('ignores casing and surrounding spaces', () => {
    expect(isAllowedEmail('  E.Hakizimana@ALUStudent.COM  ')).toBe(true);
  });

  test('rejects look-alike domains', () => {
    expect(isAllowedEmail('a@notalustudent.com')).toBe(false);
    expect(isAllowedEmail('a@alustudent.com.attacker.net')).toBe(false);
    expect(isAllowedEmail('a@alustudent.co')).toBe(false);
  });

  // A second @ could hide the real domain, and the mail would go somewhere else.
  test('rejects addresses with more than one @', () => {
    expect(isAllowedEmail('a@alustudent.com@gmail.com')).toBe(false);
  });

  test('rejects malformed input', () => {
    expect(isAllowedEmail('no-at-sign')).toBe(false);
    expect(isAllowedEmail('@alustudent.com')).toBe(false);
    expect(isAllowedEmail('a@')).toBe(false);
    expect(isAllowedEmail('')).toBe(false);
  });

  test('the allowed list is the two ALU domains', () => {
    expect(ALLOWED_DOMAINS).toEqual(['alustudent.com', 'alueducation.com']);
  });
});

describe('normalizeEmail', () => {
  test('trims and lowercases', () => {
    expect(normalizeEmail('  A.B@ALUStudent.com ')).toBe('a.b@alustudent.com');
  });

  test('turns a missing value into an empty string', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(null)).toBe('');
  });
});

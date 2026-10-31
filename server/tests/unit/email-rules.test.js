import { isAllowedEmail, normalizeEmail } from '../../src/middleware/auth.js';

describe('isAllowedEmail', () => {
  it('accepts the two ALU domains', () => {
    expect(isAllowedEmail('first.last@alustudent.com')).toBe(true);
    expect(isAllowedEmail('first.last@alueducation.com')).toBe(true);
  });

  it('ignores letter case and spaces around the address', () => {
    expect(isAllowedEmail('  First.Last@ALUStudent.COM  ')).toBe(true);
  });

  it('refuses other domains', () => {
    expect(isAllowedEmail('someone@gmail.com')).toBe(false);
    expect(isAllowedEmail('someone@alustudent.com.evil.example')).toBe(false);
    expect(isAllowedEmail('someone@sub.alustudent.com')).toBe(false);
  });

  it('refuses an address with a second @ that hides another domain', () => {
    expect(isAllowedEmail('a@alustudent.com@gmail.com')).toBe(false);
  });

  it('refuses empty and half-written addresses', () => {
    expect(isAllowedEmail('')).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
    expect(isAllowedEmail('@alustudent.com')).toBe(false);
    expect(isAllowedEmail('someone@')).toBe(false);
    expect(isAllowedEmail('no-at-sign')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('writes an address the same way every time', () => {
    expect(normalizeEmail('  A@AluStudent.com ')).toBe('a@alustudent.com');
  });

  it('turns a missing value into an empty string', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(null)).toBe('');
  });
});

import { makeAnonToken, normalizeAnonToken, hashAnonToken } from '../../src/services/anonToken.js';

const FORMAT = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

describe('makeAnonToken', () => {
  it('makes 16 characters in four groups with no look-alike letters', () => {
    for (let i = 0; i < 200; i += 1) {
      const token = makeAnonToken();
      expect(token).toMatch(FORMAT);
      expect(token).not.toMatch(/[ILOU]/);
    }
  });

  it('never repeats', () => {
    const tokens = new Set();
    for (let i = 0; i < 2000; i += 1) tokens.add(makeAnonToken());
    expect(tokens.size).toBe(2000);
  });

  it('uses every kind of character over many tokens', () => {
    const seen = new Set(Array.from({ length: 300 }, makeAnonToken).join('').replaceAll('-', ''));
    expect(seen.size).toBeGreaterThan(28);
  });
});

describe('normalizeAnonToken', () => {
  const TOKEN = '1234-5678-9ABC-DEF0';

  it('leaves a good token as it is', () => {
    expect(normalizeAnonToken(TOKEN)).toBe(TOKEN);
  });

  it('ignores case and spaces and missing hyphens', () => {
    expect(normalizeAnonToken('1234 5678 9abc def0')).toBe(TOKEN);
    expect(normalizeAnonToken('  123456789ABCDEF0  ')).toBe(TOKEN);
  });

  it('reads O as 0 and I or L as 1', () => {
    expect(normalizeAnonToken('l234-5678-9ABC-DEFO')).toBe(TOKEN);
    expect(normalizeAnonToken('I234-5678-9ABC-DEFO')).toBe(TOKEN);
  });

  it('refuses anything that cannot be a token', () => {
    for (const bad of ['', '   ', 'AAAA-BBBB-CCCC', '1234-5678-9ABC-DEF', '1234-5678-9ABC-DEF00', '1234-5678-9ABC-DEFU',
      '1234-5678-9ABC-DEF!', null, undefined, 42]) {
      expect(normalizeAnonToken(bad)).toBeNull();
    }
  });

  it('accepts every token it makes', () => {
    for (let i = 0; i < 200; i += 1) {
      const token = makeAnonToken();
      expect(normalizeAnonToken(token)).toBe(token);
    }
  });
});

describe('hashAnonToken', () => {
  it('makes a fixed 64 character hash that is not the token', () => {
    const hash = hashAnonToken('1234-5678-9ABC-DEF0');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('1234');
  });

  it('gives the same hash for the same token and a different hash for another', () => {
    expect(hashAnonToken('1234-5678-9ABC-DEF0')).toBe(hashAnonToken('1234-5678-9ABC-DEF0'));
    expect(hashAnonToken('1234-5678-9ABC-DEF0')).not.toBe(hashAnonToken('1234-5678-9ABC-DEF1'));
  });
});

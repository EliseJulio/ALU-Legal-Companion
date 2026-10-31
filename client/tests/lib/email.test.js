import { describe, it, expect } from 'vitest';
import { looksLikeEmail, isAluEmail } from '@/lib/email';
import { scrubTokenFromUrl, secureAddress } from '@/lib/url';

describe('secureAddress', () => {
  it('gives back a full https address', () => {
    expect(secureAddress('https://example.org/law')).toBe('https://example.org/law');
  });

  it('gives nothing for any other scheme or for text that is not an address', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'http://example.org', 'ftp://example.org', 'example.org', '', null, undefined]) {
      expect(secureAddress(bad)).toBeNull();
    }
  });
});

describe('looksLikeEmail', () => {
  it('accepts anything that has the shape of an address', () => {
    expect(looksLikeEmail('a@b')).toBe(true);
    expect(looksLikeEmail('expert@example.org')).toBe(true);
  });

  it('rejects what can never be an address', () => {
    for (const bad of ['', 'plain', '@b.c', 'a@', 'a b@c.d', 'a@b@c']) {
      expect(looksLikeEmail(bad)).toBe(false);
    }
  });
});

describe('isAluEmail', () => {
  it('accepts the two ALU domains in any case', () => {
    expect(isAluEmail('test.student@alustudent.com')).toBe(true);
    expect(isAluEmail(' Someone@ALUEducation.com ')).toBe(true);
  });

  it('rejects every other domain', () => {
    expect(isAluEmail('expert@example.org')).toBe(false);
    expect(isAluEmail('a@alustudent.com.evil.org')).toBe(false);
    expect(isAluEmail('nodomain')).toBe(false);
  });
});

describe('scrubTokenFromUrl', () => {
  it('removes the token and keeps the rest of the address', () => {
    window.history.pushState(null, '', '/reset-password?token=abc123&keep=1#top');
    scrubTokenFromUrl();
    expect(window.location.search).toBe('?keep=1');
    expect(window.location.hash).toBe('#top');
    expect(window.location.href).not.toMatch(/abc123/);
  });

  it('does nothing when there is no token', () => {
    window.history.pushState(null, '', '/directory?category=lawyer');
    scrubTokenFromUrl();
    expect(window.location.search).toBe('?category=lawyer');
  });
});

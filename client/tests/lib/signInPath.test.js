import { describe, it, expect } from 'vitest';
import { safeNext, signInPath } from '@/lib/url';

// After signing in a person goes back to where they were. The place to go back to arrives in the
// address, so anyone can write anything there. Only a path on this site is ever followed.
describe('safeNext', () => {
  it('accepts a path on this site, with its query', () => {
    expect(safeNext('/guides/3')).toBe('/guides/3');
    expect(safeNext('/matters/new?route=2')).toBe('/matters/new?route=2');
  });

  it('refuses an address on another site, however it is written', () => {
    for (const bad of ['https://evil.example/x', 'http://evil.example', '//evil.example', '///evil.example', '/\\evil.example', '\\\\evil.example', 'javascript:alert(1)', 'data:text/html,hi', 'evil.example/x']) {
      expect(safeNext(bad), bad).toBeNull();
    }
  });

  it('refuses anything that is not a plain path', () => {
    for (const bad of [undefined, null, '', 42, {}, '/a\nb', '/a\tb', `/${'a'.repeat(400)}`]) {
      expect(safeNext(bad), String(bad)).toBeNull();
    }
  });

  it('never sends a person back to a sign-in page, which would be a loop or a spent link', () => {
    for (const page of ['/login', '/Login', '/login/', '/register', '/forgot-password', '/reset-password?token=abc', '/redeem-invite?token=abc', '/verify-email?token=abc']) {
      expect(safeNext(page), page).toBeNull();
    }
  });
});

describe('signInPath', () => {
  it('carries the page the person is on', () => {
    expect(signInPath({ pathname: '/guides/3', search: '' })).toBe('/login?next=%2Fguides%2F3');
    expect(signInPath({ pathname: '/matters/new', search: '?route=2' })).toBe('/login?next=%2Fmatters%2Fnew%3Froute%3D2');
  });

  it('is plain /login from the front page, from a sign-in page and from nowhere', () => {
    expect(signInPath({ pathname: '/', search: '' })).toBe('/login');
    expect(signInPath({ pathname: '/login', search: '?next=%2Fguides%2F3' })).toBe('/login');
    expect(signInPath(undefined)).toBe('/login');
  });

  it('never carries a one-time code', () => {
    expect(signInPath({ pathname: '/reset-password', search: '?token=abc' })).toBe('/login');
    expect(signInPath({ pathname: '/ask/check', search: '?code=1234' })).not.toContain('1234');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hasRole, canOwnActivity, saveSession, readSession, clearSession } from '@/lib/auth';
import { getToken, apiGet } from '@/lib/api';

const STUDENT = { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' };

beforeEach(() => {
  clearSession();
  localStorage.clear();
});
afterEach(() => {
  clearSession();
});

describe('hasRole', () => {
  it('is true when the user holds one of the roles', () => {
    expect(hasRole({ role: 'admin' }, ['admin'])).toBe(true);
    expect(hasRole({ role: 'legal_expert' }, ['admin', 'legal_expert'])).toBe(true);
  });

  it('is false for another role', () => {
    expect(hasRole({ role: 'student' }, ['admin'])).toBe(false);
  });

  it('is false for nobody and for a session with no role', () => {
    expect(hasRole(null, ['admin'])).toBe(false);
    expect(hasRole(undefined, ['admin'])).toBe(false);
    expect(hasRole({}, ['admin'])).toBe(false);
  });
});

describe('canOwnActivity', () => {
  it('is true for students and staff only', () => {
    expect(canOwnActivity({ role: 'student' })).toBe(true);
    expect(canOwnActivity({ role: 'staff' })).toBe(true);
    expect(canOwnActivity({ role: 'admin' })).toBe(false);
    expect(canOwnActivity({ role: 'legal_expert' })).toBe(false);
    expect(canOwnActivity(null)).toBe(false);
  });
});

describe('saveSession and readSession', () => {
  it('keeps the token and the user', () => {
    saveSession({ token: 'tok-1', user: STUDENT });
    expect(getToken()).toBe('tok-1');
    expect(readSession()).toEqual(STUDENT);
  });

  it('keeps only the four public fields of the user', () => {
    saveSession({ token: 'tok-1', user: { ...STUDENT, password_hash: 'x' } });
    const stored = JSON.parse(localStorage.getItem('alc.user'));
    expect(Object.keys(stored).sort()).toEqual(['email', 'id', 'name', 'role']);
  });

  it('refuses a session with no token and writes nothing', () => {
    for (const bad of [undefined, null, '']) {
      expect(() => saveSession({ token: bad, user: STUDENT })).toThrow();
    }
    expect(localStorage.getItem('alc.user')).toBeNull();
    expect(readSession()).toBeNull();
  });

  it('reads nobody when there is a stored user but no token', () => {
    localStorage.setItem('alc.user', JSON.stringify(STUDENT));
    expect(readSession()).toBeNull();
  });

  it('reads nobody when the stored user is broken', () => {
    saveSession({ token: 'tok-1', user: STUDENT });
    localStorage.setItem('alc.user', '{not json');
    expect(readSession()).toBeNull();
  });
});

describe('clearSession', () => {
  it('removes the token and the user', () => {
    saveSession({ token: 'tok-1', user: STUDENT });
    clearSession();
    expect(getToken()).toBeNull();
    expect(localStorage.getItem('alc.user')).toBeNull();
    expect(readSession()).toBeNull();
  });
});

describe('when the server ends the session', () => {
  it('removes the stored user as well as the token', async () => {
    saveSession({ token: 'tok-1', user: STUDENT });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 401, headers: { get: () => null }, json: async () => ({ error: 'Invalid or expired session' }),
    });
    await apiGet('/auth/me').catch(() => {});
    expect(localStorage.getItem('alc.user')).toBeNull();
    expect(readSession()).toBeNull();
  });
});

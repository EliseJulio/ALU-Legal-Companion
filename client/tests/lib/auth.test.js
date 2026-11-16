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

describe('who may do what in the browser', () => {
  it('checks the role, and treats nobody as having no role', () => {
    expect(hasRole({ role: 'admin' }, ['admin'])).toBe(true);
    expect(hasRole({ role: 'student' }, ['admin'])).toBe(false);
    expect(hasRole(null, ['admin'])).toBe(false);
  });

  it('lets only students and staff own matters and questions', () => {
    expect(canOwnActivity({ role: 'student' })).toBe(true);
    expect(canOwnActivity({ role: 'staff' })).toBe(true);
    expect(canOwnActivity({ role: 'admin' })).toBe(false);
    expect(canOwnActivity({ role: 'legal_expert' })).toBe(false);
  });
});

describe('the stored session', () => {
  it('keeps the token and only the four public fields of the user', () => {
    saveSession({ token: 'tok-1', user: { ...STUDENT, password_hash: 'x' } });
    expect(getToken()).toBe('tok-1');
    expect(Object.keys(JSON.parse(localStorage.getItem('alc.user'))).sort()).toEqual(['email', 'id', 'name', 'role']);
  });

  it('refuses a session with no token', () => {
    expect(() => saveSession({ token: '', user: STUDENT })).toThrow();
    expect(readSession()).toBeNull();
  });

  it('removes the stored user as well as the token when the server ends the session', async () => {
    saveSession({ token: 'tok-1', user: STUDENT });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 401, headers: { get: () => null }, json: async () => ({ error: 'Invalid or expired session' }),
    });
    await apiGet('/auth/me').catch(() => {});
    expect(getToken()).toBeNull();
    expect(readSession()).toBeNull();
  });
});

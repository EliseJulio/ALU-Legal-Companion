import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookUpAnonQuestion } from '@/lib/questions';
import { saveSession, clearSession } from '@/lib/auth';

describe('looking up an anonymous question', () => {
  const reply = (status, body) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => body });

  beforeEach(() => {
    clearSession();
    localStorage.clear();
    global.fetch = vi.fn(async () => reply(200, { id: 3, text: 'Q', answer: null, status: 'open' }));
  });

  it('posts the code in the body to the status route, with no login and nothing in the address', async () => {
    saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'a@example.org', role: 'student' } });
    const result = await lookUpAnonQuestion('1234-5678-9ABC-DEFG');
    const [url, options] = global.fetch.mock.calls[0];
    expect(String(url)).toMatch(/\/questions\/anon\/status$/);
    expect(String(url)).not.toContain('1234');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ code: '1234-5678-9ABC-DEFG' });
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(result).toEqual({ id: 3, text: 'Q', answer: null, status: 'open' });
  });
});

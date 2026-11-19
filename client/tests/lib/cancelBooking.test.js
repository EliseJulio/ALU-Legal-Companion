import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canCancel, cancelOwnBooking, cancelAnonBooking } from '@/lib/bookings';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

beforeEach(() => {
  clearSession();
  localStorage.clear();
  global.fetch = vi.fn(async () => reply(200, { id: 7, status: 'cancelled' }));
});

describe('which consultations can be cancelled', () => {
  const NOW = new Date('2026-11-04T08:00:00.000Z');
  const FUTURE = '2026-11-12T10:00:00.000Z';
  const PAST = '2026-11-01T10:00:00.000Z';

  it('allows only a request or an accepted time still to come, and nothing already over, declined or unreadable', () => {
    expect(canCancel({ status: 'requested', slot: FUTURE }, NOW)).toBe(true);
    expect(canCancel({ status: 'accepted', slot: FUTURE }, NOW)).toBe(true);
    expect(canCancel({ status: 'accepted', slot: PAST }, NOW)).toBe(false);
    expect(canCancel({ status: 'requested', slot: PAST }, NOW)).toBe(false);
    for (const status of ['declined', 'completed', 'cancelled']) {
      expect(canCancel({ status, slot: FUTURE }, NOW)).toBe(false);
    }
    expect(canCancel({ status: 'accepted', slot: 'not a time' }, NOW)).toBe(false);
    expect(canCancel(null, NOW)).toBe(false);
  });
});

describe('cancelling a signed-in booking', () => {
  it('posts to the booking with the login', async () => {
    saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'a@example.org', role: 'student' } });
    const result = await cancelOwnBooking(7);
    const [url, options] = global.fetch.mock.calls[0];
    expect(String(url)).toMatch(/\/bookings\/7\/cancel$/);
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer tok-1');
    expect(result).toMatchObject({ status: 'cancelled' });
  });
});

describe('cancelling an anonymous booking', () => {
  it('sends the code in the body only, with no login and nothing in the address', async () => {
    global.fetch = vi.fn(async () => reply(200, { status: 'cancelled' }));
    const result = await cancelAnonBooking('1234-5678-9ABC-DEFG');
    const [url, options] = global.fetch.mock.calls[0];
    expect(String(url)).toMatch(/\/bookings\/anon\/cancel$/);
    expect(String(url)).not.toContain('1234');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ anon_token: '1234-5678-9ABC-DEFG' });
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(result).toEqual({ status: 'cancelled' });
  });
});

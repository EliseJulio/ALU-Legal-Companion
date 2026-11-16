import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiGet, apiPost, setToken, getToken, clearToken, ApiError, onSessionExpired,
} from '@/lib/api';

// A fake answer from fetch.
const reply = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => headers[name] ?? null },
  json: async () => body,
});

let fetchMock;
beforeEach(() => {
  clearToken();
  localStorage.clear();
  fetchMock = vi.fn();
  global.fetch = fetchMock;
});
afterEach(() => clearToken());

const lastOptions = () => fetchMock.mock.calls.at(-1)[1];

describe('what a request carries', () => {
  it('sends the login token once there is one', async () => {
    setToken('tok-abc');
    fetchMock.mockResolvedValue(reply(200, {}));
    await apiGet('/auth/me');
    expect(lastOptions().headers.Authorization).toBe('Bearer tok-abc');
  });

  it('leaves the login out of an anonymous request', async () => {
    setToken('tok-abc');
    fetchMock.mockResolvedValue(reply(201, {}));
    await apiPost('/questions/anonymous', { text: 'Hi' }, { anonymous: true });
    expect(lastOptions().headers).not.toHaveProperty('Authorization');
  });
});

describe('what comes back', () => {
  it('shows the server’s own words when it refuses a request', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'Password must be at least 8 characters' }));
    const error = await apiPost('/auth/register', {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: 'Password must be at least 8 characters' });
  });

  it('reads how long to wait from a 429', async () => {
    fetchMock.mockResolvedValue(reply(429, { error: 'Too many attempts.' }, { 'Retry-After': '900' }));
    const error = await apiPost('/auth/login', {}).catch((e) => e);
    expect(error).toMatchObject({ status: 429, retryAfter: 900 });
  });
});

describe('when the login stops working', () => {
  it('drops the token on a 401 and tells the page once', async () => {
    setToken('tok-abc');
    const listener = vi.fn();
    const stop = onSessionExpired(listener);
    fetchMock.mockResolvedValue(reply(401, { error: 'Invalid or expired session' }));
    await apiGet('/auth/me').catch(() => {});
    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('keeps the token on a 403, because only the role is wrong', async () => {
    setToken('tok-abc');
    fetchMock.mockResolvedValue(reply(403, { error: 'You do not have permission to do that' }));
    await apiGet('/admin/users').catch(() => {});
    expect(getToken()).toBe('tok-abc');
  });
});

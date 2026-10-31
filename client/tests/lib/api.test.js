import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiGet, apiPost, apiPut, apiDelete, setToken, getToken, clearToken, ApiError, onSessionExpired,
} from '@/lib/api';

// A fake answer from fetch.
const reply = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => headers[name] ?? null },
  json: async () => {
    if (body === undefined) throw new Error('no body');
    return body;
  },
});

let fetchMock;
beforeEach(() => {
  clearToken();
  localStorage.clear();
  fetchMock = vi.fn();
  global.fetch = fetchMock;
});
afterEach(() => {
  clearToken();
});

const lastCall = () => fetchMock.mock.calls.at(-1);

describe('what a request looks like', () => {
  it('sends a GET with no body and no login when signed out', async () => {
    fetchMock.mockResolvedValue(reply(200, []));
    await apiGet('/guides');
    const [url, options] = lastCall();
    expect(url).toMatch(/^https?:\/\/.+\/guides$/);
    expect(options.method).toBe('GET');
    expect(options.headers.Accept).toBe('application/json');
    expect(options.headers).not.toHaveProperty('Content-Type');
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(options.body).toBeUndefined();
  });

  it('sends the login token once there is one', async () => {
    setToken('tok-abc');
    fetchMock.mockResolvedValue(reply(200, {}));
    await apiGet('/auth/me');
    expect(lastCall()[1].headers.Authorization).toBe('Bearer tok-abc');
  });

  it('sends a POST body as JSON', async () => {
    fetchMock.mockResolvedValue(reply(201, { id: 1 }));
    await apiPost('/questions', { text: 'Hello' });
    const [, options] = lastCall();
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ text: 'Hello' });
  });

  it('leaves the login out of an anonymous request', async () => {
    setToken('tok-abc');
    fetchMock.mockResolvedValue(reply(201, {}));
    await apiPost('/questions/anonymous', { text: 'Hi' }, { anonymous: true });
    expect(lastCall()[1].headers).not.toHaveProperty('Authorization');
  });

  it('uses PUT and DELETE for those verbs', async () => {
    fetchMock.mockResolvedValue(reply(200, {}));
    await apiPut('/guides/1', { title: 'New' });
    expect(lastCall()[1].method).toBe('PUT');
    fetchMock.mockResolvedValue(reply(204));
    await apiDelete('/matters/1');
    expect(lastCall()[1].method).toBe('DELETE');
  });
});

describe('what comes back', () => {
  it('returns the parsed JSON', async () => {
    fetchMock.mockResolvedValue(reply(200, { hello: 'world' }));
    expect(await apiGet('/x')).toEqual({ hello: 'world' });
  });

  it('returns null for 204', async () => {
    fetchMock.mockResolvedValue(reply(204));
    expect(await apiDelete('/x')).toBeNull();
  });

  it('turns the server error into an ApiError with the server’s own words', async () => {
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

  it('reports an ApiError when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await apiGet('/x').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('refuses a 200 whose body cannot be read', async () => {
    fetchMock.mockResolvedValue(reply(200, undefined));
    const error = await apiGet('/x').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
  });
});

describe('when the login stops working', () => {
  it('drops the token on a 401 and tells the listeners once', async () => {
    setToken('tok-abc');
    const listener = vi.fn();
    const stop = onSessionExpired(listener);
    fetchMock.mockResolvedValue(reply(401, { error: 'Invalid or expired session' }));
    await apiGet('/auth/me').catch(() => {});
    expect(getToken()).toBeNull();
    expect(localStorage.getItem('alc.token')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('keeps the token on a 403 because only the role is wrong', async () => {
    setToken('tok-abc');
    const listener = vi.fn();
    const stop = onSessionExpired(listener);
    fetchMock.mockResolvedValue(reply(403, { error: 'You do not have permission to do that' }));
    await apiGet('/admin/users').catch(() => {});
    expect(getToken()).toBe('tok-abc');
    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it('stops telling a listener once it has unsubscribed', async () => {
    setToken('tok-abc');
    const listener = vi.fn();
    onSessionExpired(listener)();
    fetchMock.mockResolvedValue(reply(401, { error: 'x' }));
    await apiGet('/x').catch(() => {});
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('the stored token', () => {
  it('is written to storage and removed from it', () => {
    setToken('tok-abc');
    expect(localStorage.getItem('alc.token')).toBe('tok-abc');
    clearToken();
    expect(localStorage.getItem('alc.token')).toBeNull();
  });
});

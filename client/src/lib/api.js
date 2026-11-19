import { announceChange } from '@/lib/live';

// The only door to the API. Every answer the server can give is turned into a result or an
// ApiError here so a page never has to read a raw fetch response.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const STORAGE_KEY = 'alc.token';
// A request that does not answer in time gives up. A file upload gets longer.
const LIMIT_MS = 30000;
const UPLOAD_LIMIT_MS = 60000;
const TOO_LONG = 'The server took too long to answer. Please try again.';
const UNREACHABLE = 'Could not reach the server. Check your connection and try again.';

// The login token is kept in memory and in localStorage so a reload keeps the login.
// The text "undefined" or "null" is not a token and is ignored.
let token = null;
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  token = stored && stored !== 'undefined' && stored !== 'null' ? stored : null;
} catch {
  /* Private mode. The login lasts for this tab only. */
}

// A value that is not text is cleared and not stored. localStorage would turn undefined into
// the text "undefined". That is true when it is read back and the app would think it was signed in.
export function setToken(value) {
  if (typeof value !== 'string' || value === '') {
    clearToken();
    return;
  }
  token = value;
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
}
export function getToken() { return token; }
export function clearToken() {
  token = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// Reads the login from storage again. Another tab may have signed in or out.
export function reloadToken() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    token = stored && stored !== 'undefined' && stored !== 'null' ? stored : null;
  } catch {
    /* Storage is blocked. The login already in memory stays. */
  }
}

// "The session just ended." This file is the lowest layer. It cannot reach the user object
// or the React state without a circular import. So it announces and each layer above tidies up
// what it owns: auth.js drops the stored user and AuthContext drops the state.
const sessionExpiredListeners = new Set();

export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function announceSessionExpired() {
  // Each listener is isolated. One that throws must not stop the others from cleaning up.
  for (const listener of sessionExpiredListeners) {
    try { listener(); } catch { /* ignore */ }
  }
}

export class ApiError extends Error {
  // `code` is a short machine-readable reason the server may send, such as 'not_verified'.
  constructor(status, message, retryAfter = null, code = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
    this.code = code;
  }
}

// Starts the time limit for one request. The returned timer must be cleared when the request
// and its reply body are finished.
function startLimit(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, timer };
}

// `anonymous: true` leaves the login out of the request. An anonymous page must say so itself.
// The server would ignore the login on those routes. Still the page should never send a
// credential that an anonymous request does not need.
async function request(method, path, body, { anonymous = false, raw = false, form = false, keepLogin = false, limit = LIMIT_MS } = {}) {
  const headers = { Accept: 'application/json' };
  // `raw` sends a file as the body itself. That is how a matter document is uploaded.
  // `form` sends a FormData. The browser writes the Content-Type itself, with the boundary.
  if (body !== undefined && !form) headers['Content-Type'] = raw ? body.type : 'application/json';
  // The token in use when the request starts. A 401 below clears only this same token.
  const sent = anonymous ? null : token;
  if (sent) headers.Authorization = `Bearer ${sent}`;

  const { signal, timer } = startLimit(limit);
  try {
    let res;
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        signal,
        body: body === undefined ? undefined : (raw || form) ? body : JSON.stringify(body),
      });
    } catch {
      // No answer at all. Status 0 lets a page offer "check your connection".
      throw new ApiError(0, signal.aborted ? TOO_LONG : UNREACHABLE);
    }

    if (res.status === 204) {
      // A write that answers with no body still changed something. The open pages ask again.
      if (method !== 'GET') announceChange();
      return null;
    }

    let payload = null;
    let parsed = false;
    try { payload = await res.json(); parsed = true; } catch { /* empty or not JSON */ }
    if (!parsed && signal.aborted) throw new ApiError(0, TOO_LONG);

    if (res.ok) {
      // A 200 with a body we cannot read is not "loaded with nothing". It happens when the API
      // address points at the website itself, which answers any path with its home page.
      // Pages would then fail on a missing value. This puts it in the same error message as the rest.
      if (!parsed) {
        throw new ApiError(res.status, 'The server sent a reply we could not read. Please try again.');
      }
      // A request that changed something tells the open pages and the bell to ask again now.
      if (method !== 'GET') announceChange();
      return payload;
    }

    // 401 means the login is gone or not valid so it is dropped and the next request is made as
    // a visitor. 403 means the login is fine and the role is wrong. It must be kept. Clearing it
    // would sign an admin out for opening one page.
    // `keepLogin` is for a request where 401 means a wrong password and the login is still good.
    // A login made in another tab while this request was on its way is not the one refused.
    if (res.status === 401 && !keepLogin && sent && token === sent) {
      clearToken();
      announceSessionExpired();
    }

    const retryAfter = res.headers.get('Retry-After');
    throw new ApiError(
      res.status,
      payload?.error || 'Something went wrong. Please try again.',
      retryAfter ? Number(retryAfter) : null,
      payload?.code ?? null,
    );
  } finally {
    clearTimeout(timer);
  }
}

export const apiGet = (path, options) => request('GET', path, undefined, options);
export const apiPost = (path, body = {}, options) => request('POST', path, body, options);
export const apiPut = (path, body = {}) => request('PUT', path, body);
// A body is optional. Deleting an account sends the password in it.
export const apiDelete = (path, body, options) => request('DELETE', path, body, options);
export const apiUpload = (path, file) => request('POST', path, file, { raw: true, limit: UPLOAD_LIMIT_MS });
export const apiPostForm = (path, formData) => request('POST', path, formData, { form: true, limit: UPLOAD_LIMIT_MS });

// A file as a Blob. A document download needs the login and a plain link cannot send it. So the
// page fetches the file itself and hands the browser the bytes.
export async function apiBlob(path) {
  const headers = {};
  const sent = token;
  if (sent) headers.Authorization = `Bearer ${sent}`;
  const { signal, timer } = startLimit(LIMIT_MS);
  try {
    let res;
    try {
      res = await fetch(`${BASE}${path}`, { headers, signal });
    } catch {
      throw new ApiError(0, signal.aborted ? TOO_LONG : UNREACHABLE);
    }
    if (res.ok) return await res.blob();
    // The same rule as every other request. A 401 means the login is gone.
    if (res.status === 401 && token === sent) {
      clearToken();
      announceSessionExpired();
    }
    let payload = null;
    try { payload = await res.json(); } catch { /* not JSON */ }
    throw new ApiError(res.status, payload?.error || 'Something went wrong. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

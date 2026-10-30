// The only door to the API. Every answer the server can give is turned into a result or an
// ApiError here so a page never has to read a raw fetch response.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const STORAGE_KEY = 'alc.token';

// The login token is kept in memory and in localStorage so a reload keeps the login.
// The text "undefined" or "null" is not a token. It is what an old bug could leave behind.
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
  constructor(status, message, retryAfter = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

// `anonymous: true` leaves the login out of the request. An anonymous page must say so itself.
// The server would ignore the login on those routes. Still the page should never send a
// credential that an anonymous request does not need.
async function request(method, path, body, { anonymous = false, raw = false } = {}) {
  const headers = { Accept: 'application/json' };
  // `raw` sends a file as the body itself. That is how a matter document is uploaded.
  if (body !== undefined) headers['Content-Type'] = raw ? body.type : 'application/json';
  if (token && !anonymous) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
  } catch {
    // No answer at all. Status 0 lets a page offer "check your connection".
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return null;

  let payload = null;
  let parsed = false;
  try { payload = await res.json(); parsed = true; } catch { /* empty or not JSON */ }

  if (res.ok) {
    // A 200 with a body we cannot read is not "loaded with nothing". It happens when the API
    // address points at the website itself, which answers any path with its home page.
    // Pages would then fail on a missing value. This puts it in the same error message as the rest.
    if (!parsed) {
      throw new ApiError(res.status, 'The server sent a reply we could not read. Please try again.');
    }
    return payload;
  }

  // 401 means the login is gone or not valid so it is dropped and the next request is made as
  // a visitor. 403 means the login is fine and the role is wrong. It must be kept. Clearing it
  // would sign an admin out for opening one page.
  if (res.status === 401) {
    clearToken();
    announceSessionExpired();
  }

  const retryAfter = res.headers.get('Retry-After');
  throw new ApiError(
    res.status,
    payload?.error || 'Something went wrong. Please try again.',
    retryAfter ? Number(retryAfter) : null,
  );
}

export const apiGet = (path, options) => request('GET', path, undefined, options);
export const apiPost = (path, body = {}, options) => request('POST', path, body, options);
export const apiPut = (path, body = {}) => request('PUT', path, body);
export const apiDelete = (path) => request('DELETE', path);
export const apiUpload = (path, file) => request('POST', path, file, { raw: true });
// A full address on the API's origin. For things the browser fetches itself such as an img src.
// The page and the API are on different origins so a path starting with / would reach the wrong server.
export const apiUrl = (path) => `${BASE}${path}`;

// A file as a Blob. A document download needs the login and a plain link cannot send it. So the
// page fetches the file itself and hands the browser the bytes.
export async function apiBlob(path) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { headers });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }
  if (res.ok) return res.blob();
  // The same rule as every other request. A 401 means the login is gone.
  if (res.status === 401) {
    clearToken();
    announceSessionExpired();
  }
  let payload = null;
  try { payload = await res.json(); } catch { /* not JSON */ }
  throw new ApiError(res.status, payload?.error || 'Something went wrong. Please try again.');
}

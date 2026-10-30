// Removes a spent one-time token from the address bar.
//
// Emails link to /verify-email, /reset-password and /redeem-invite with the token in the
// address. It has to be there because the reader clicks a link. Once the server has answered
// the token is spent. Leaving it in the address would keep it in history and in autocomplete.
// Only the token is removed. Any other part of the address stays.
export function scrubTokenFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('token')) return;
    url.searchParams.delete('token');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // No history support. The page still works. Never let cleaning up break the page.
  }
}

// An address that came from the database is only made into a link when it is a full https
// address. A value such as javascript:... would run code when clicked. The server checks this
// when it saves. The page checks again before it makes a link. Anything else gives null.
export function secureAddress(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

// The pages a person signs in through. Going "back" to one of them after signing in would be a
// loop, or would use up a one-time link a second time.
const SIGN_IN_PAGES = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/redeem-invite', '/verify-email']);
// A one-time code is never carried from one page to the next in an address.
const SECRET_PARAMS = ['token', 'code', 'invite_token'];

// Where to go after signing in. The place arrives in the address, so anyone can write anything
// there. Only a plain path on this site is followed. An address on another site, a path that
// starts with two slashes or a backslash, a control character, or a sign-in page gives null.
export function safeNext(raw) {
  if (typeof raw !== 'string' || raw === '' || raw.length > 300) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  const path = raw.split(/[?#]/)[0];
  const plain = path.toLowerCase().replace(/\/+$/, '') || '/';
  return SIGN_IN_PAGES.has(plain) ? null : raw;
}

// The sign-in link for the page a person is on. After signing in they come back here. The front
// page and the sign-in pages need no return, so they give plain /login. A one-time code in the
// query is dropped first.
export function signInPath(where) {
  if (!where) return '/login';
  const params = new URLSearchParams(where.search ?? '');
  SECRET_PARAMS.forEach((key) => params.delete(key));
  const query = params.toString();
  const path = `${where.pathname ?? ''}${query ? `?${query}` : ''}`;
  const next = path === '/' ? null : safeNext(path);
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login';
}

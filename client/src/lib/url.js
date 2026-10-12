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

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

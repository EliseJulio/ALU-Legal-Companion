// A sign-out that the server never heard of. The browser is signed out either way.
// On a shared machine the token may still work on the server. The landing page says so once.
// The flag is in sessionStorage because the sign-out moves to another page and the notice shows there.
// Storage can be blocked. Then the flag cannot be kept and no notice is shown. Nothing breaks.
const KEY = 'alc.signed-out-offline';

export function rememberSignedOutOffline() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* Storage is blocked. The notice is not shown. */
  }
}

// Reads the flag without clearing it. Reading is safe to repeat, so a double render gets the same answer.
// The notice clears the flag itself, once it is on screen.
export function readSignedOutOffline() {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function clearSignedOutOffline() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Nothing to clear. */
  }
}

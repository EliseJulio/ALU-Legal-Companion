import { setToken, getToken, clearToken, onSessionExpired } from '@/lib/api';

// The token is kept by api.js. This file keeps the user object that goes with it.
// The server has no endpoint that rebuilds the user from the token alone so without a stored
// copy the name and role would be lost on every reload.
const USER_KEY = 'alc.user';

// Only the four fields the server calls public. Anything else such as a password field on a
// form object is dropped. Storage is the last place a secret should end up.
function publicUser({ id, name, email, role }) {
  return { id, name, email, role };
}

// Students and staff are the only roles that own saved guides, questions, bookings and matters.
// The server answers any other role with 403 on those routes.
const OWNER_ROLES = ['student', 'staff'];

// Does this session hold one of these roles? It accepts null because every caller passes the
// user straight from useAuth, which is null when signed out. A throw here would blank a page
// just to hide a link. A session with no role holds no role.
export function hasRole(user, roles) {
  return roles.includes(user?.role);
}

// May this account keep saved guides, questions, bookings and matters? This is not the same as
// "is signed in". An admin and a legal expert are real sessions that those routes refuse.
export function canOwnActivity(user) {
  return hasRole(user, OWNER_ROLES);
}

export function saveSession({ token, user }) {
  // A session with no token is a mistake at the call site and it throws on purpose. It would
  // show a name in the header over an account that no request could sign in as.
  // It throws before anything is written, so a refused session leaves nothing behind.
  if (typeof token !== 'string' || token === '') {
    throw new Error('saveSession needs a token: a session without one cannot authenticate any request.');
  }
  setToken(token);
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(publicUser(user)));
  } catch {
    // Private mode. The session works for this tab and does not survive a reload.
  }
}

export function readSession() {
  // The token decides. A stored user without a token is signed out.
  if (!getToken()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  clearToken();
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    /* The token is already gone and that is what decides signed in. */
  }
}

// When api.js says the session ended, the stored user goes too. This runs when the file is
// loaded and not from a React effect. A name and an email must not stay in storage on a shared
// campus machine just because nothing happens to be mounted.
onSessionExpired(() => {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    
  }
});

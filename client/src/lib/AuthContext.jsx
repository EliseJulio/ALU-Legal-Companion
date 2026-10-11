import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { saveSession, readSession, clearSession } from '@/lib/auth';
import { onSessionExpired, apiPost } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // The function form reads storage once. Reading it on every render would waste work.
  const [user, setUser] = useState(() => readSession());

  const signIn = useCallback((session) => {
    saveSession(session);
    setUser(session.user);
  }, []);

  const signOut = useCallback(async () => {
    // The server is told first, while the token is still there. The server ends the session
    // on its side. Clearing the browser alone would leave the same token working for days.
    // The local clear is in `finally`. If the request fails the person must still end up
    // signed out here. This app runs on shared campus machines.
    try {
      await apiPost('/auth/logout');
    } catch {
      /* The session ends here either way. */
    } finally {
      clearSession();
      setUser(null);
    }
  }, []);

  // A session can also end without anyone choosing it. The token lasts 7 days and the server
  // may refuse it. api.js drops the token and announces it. This is where the screen catches up.
  useEffect(() => onSessionExpired(() => setUser(null)), []);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// oxlint wants a file that exports a component to export only components. This file is the
// one door to the session, so the hook stays beside the provider.
// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  // Outside the provider a component would quietly behave as signed out. That is the hardest
  // failure to notice so it fails loudly.
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

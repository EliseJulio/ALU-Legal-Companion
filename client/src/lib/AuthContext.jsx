import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { saveSession, saveUser, readSession, clearSession } from '@/lib/auth';
import { onSessionExpired, apiGet, apiPost } from '@/lib/api';
import { useLiveTick } from '@/lib/live';

const AuthContext = createContext(null);

// `syncSession` keeps the saved name and email and role in step with the account on the server.
// The real app turns it on. A person renamed behind the scenes then sees the new name everywhere.
export function AuthProvider({ children, syncSession = false }) {
  // The function form reads storage once. Reading it on every render would waste work.
  const [user, setUser] = useState(() => readSession());

  const signIn = useCallback((session) => {
    saveSession(session);
    setUser(session.user);
  }, []);

  // Resolves true when the server answered the sign-out. It resolves false when no answer came (status 0).
  // The browser is signed out either way. The caller decides what to tell the person.
  const signOut = useCallback(async () => {
    // The server is told first, while the token is still there. The server ends the session
    // on its side. Clearing the browser alone would leave the same token working for days.
    // The local clear is in `finally`. If the request fails the person must still end up
    // signed out here. This app runs on shared campus machines.
    let reached = true;
    try {
      await apiPost('/auth/logout');
    } catch (error) {
      // Status 0 is "no answer at all". Any HTTP answer means the server was reached.
      reached = error?.status !== 0;
    } finally {
      clearSession();
      setUser(null);
    }
    return reached;
  }, []);

  // A session can also end without anyone choosing it. The token lasts 7 days and the server
  // may refuse it. api.js drops the token and announces it. This is where the screen catches up.
  useEffect(() => onSessionExpired(() => setUser(null)), []);

  // The saved copy of the user is checked against the server when the app opens and again when the
  // person comes back to the tab and every minute. A failed check changes nothing.
  const tick = useLiveTick(syncSession && user ? 60000 : 0);
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!syncSession || userId === null) return undefined;
    let cancelled = false;
    apiGet('/auth/me')
      .then((me) => {
        if (cancelled) return;
        setUser((current) => {
          if (!current || current.id !== me.id) return current;
          if (current.name === me.name && current.email === me.email && current.role === me.role) return current;
          const next = { id: current.id, name: me.name, email: me.email, role: me.role };
          saveUser(next);
          return next;
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [syncSession, userId, tick]);

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

// The signed-in user or null with no provider.
// It is for a small part of a page that only needs to know who is signed in (the breadcrumb).
// A page that needs the session uses useAuth.
// oxlint-disable-next-line react/only-export-components
export function useOptionalUser() {
  return useContext(AuthContext)?.user ?? null;
}

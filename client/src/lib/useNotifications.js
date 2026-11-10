import { useEffect, useState } from 'react';
import { loadNotifications, readIds, saveReadIds } from '@/lib/notifications';
import { LIVE, useLiveTick } from '@/lib/live';

// The bell's data for one signed in person. It loads when the person is known and again on
// `reload`. The read items are kept per person on this device, so a shared machine does not
// mix two people's read state.
export function useNotifications(user) {
  const userId = user?.id ?? null;
  const role = user?.role ?? null;
  // Every reload changes the key, so the answer to an old request is never shown for a new one.
  const [nonce, setNonce] = useState(0);
  const key = `${userId}:${role}:${nonce}`;
  // The bell asks again in the background. That does not change the key so the list is not blanked.
  const tick = useLiveTick(userId === null ? 0 : LIVE.every, { onChange: true });
  const [loaded, setLoaded] = useState({ key: '', items: [], partial: false, error: null });
  const [readState, setReadState] = useState(() => ({ userId, ids: readIds(userId) }));

  useEffect(() => {
    if (userId === null) return undefined;
    let cancelled = false;
    loadNotifications({ id: userId, role }).then(
      ({ items, partial }) => { if (!cancelled) setLoaded({ key, items, partial, error: null }); },
      // A failed background refresh keeps the list that is already shown.
      (error) => { if (!cancelled) setLoaded((prev) => (prev.key === key && !prev.error ? prev : { key, items: [], partial: false, error })); },
    );
    return () => { cancelled = true; };
  }, [key, userId, role, tick]);

  // While a reload runs the last list stays on the screen. It is not blanked for a moment.
  const pending = loaded.key !== key;
  const read = readState.userId === userId ? readState.ids : readIds(userId);
  const readSet = new Set(read);
  const status = userId === null ? 'idle' : pending ? 'loading' : loaded.error ? 'error' : 'ready';
  const items = loaded.items;
  const unread = items.filter((item) => !readSet.has(item.id)).length;

  function remember(ids) {
    saveReadIds(userId, ids);
    setReadState({ userId, ids });
  }

  return {
    status,
    items,
    partial: pending ? false : loaded.partial,
    error: pending ? null : loaded.error,
    unread,
    isRead: (id) => readSet.has(id),
    markRead: (id) => {
      if (userId === null || readSet.has(id)) return;
      remember([...read, id]);
    },
    markAllRead: () => {
      if (userId === null) return;
      remember([...new Set([...read, ...items.map((item) => item.id)])]);
    },
    reload: () => setNonce((n) => n + 1),
  };
}

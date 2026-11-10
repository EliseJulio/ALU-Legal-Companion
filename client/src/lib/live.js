import { useEffect, useState } from 'react';

// Pages stay up to date without a reload. There are no sockets because the free server sleeps and
// restarts. A page asks again every so often while its tab is open. It also asks again at once when
// the person comes back to the tab or the connection returns or they just changed something.
export const LIVE = { every: 30000 };

const CHANGED = 'alc:data-changed';

// Called when a request that changes data has succeeded. The bell then asks again at once.
export function announceChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED));
}

// A number that goes up each time a page should ask again. It stays at 0 when `everyMs` is 0.
// With `onChange` it also goes up when the person changes something. A page that reloads itself
// after its own actions leaves that off. The bell turns it on.
export function useLiveTick(everyMs, { onChange = false } = {}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!everyMs) return undefined;
    const bump = () => setTick((n) => n + 1);
    const wake = () => { if (document.visibilityState === 'visible') bump(); };
    const timer = setInterval(wake, everyMs);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    if (onChange) window.addEventListener(CHANGED, bump);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener(CHANGED, bump);
    };
  }, [everyMs, onChange]);
  return tick;
}

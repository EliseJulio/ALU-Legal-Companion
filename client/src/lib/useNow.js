import { useEffect, useState } from 'react';

const MINUTE_MS = 60 * 1000;

// The current moment, read again every minute and when the tab comes back into view. A page left
// open past midnight then moves on to the new day, and a consultation whose time has passed stops
// counting as upcoming.
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const wake = () => { if (document.visibilityState === 'visible') tick(); };
    const timer = setInterval(tick, MINUTE_MS);
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);
  return now;
}

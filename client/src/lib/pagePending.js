import { useEffect, useState, useSyncExternalStore } from 'react';

// Counts the page files that are downloading right now. A page that is already on screen stays there
// while the next one downloads (see main.jsx), so the shell needs a signal to show a thin bar. The
// signal is this counter. lazyPage.js raises it when a page file is asked for and lowers it when the
// file settles.
//
// A second count tracks the plain Loading area that PageLoading shows on the very first render, when no
// page is on screen yet. There is no old page to keep then, so the bar stays hidden.
export const LOADING_BAR_DELAY_MS = 150;

let pending = 0;
let fallbacks = 0;
const listeners = new Set();

// A component listening to the counter is told in a microtask and not at once.
// Changing a store during a render makes React warn. A page file is first asked for during a render.
function announce() {
  queueMicrotask(() => {
    for (const listener of listeners) listener();
  });
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function beginPageLoad() {
  pending += 1;
  announce();
}

export function endPageLoad() {
  pending = Math.max(0, pending - 1);
  announce();
}

export function getPagePending() {
  return pending;
}

// Called when the Loading area appears. The returned function takes it away again.
export function holdFallback() {
  fallbacks += 1;
  announce();
  return () => {
    fallbacks = Math.max(0, fallbacks - 1);
    announce();
  };
}

export function getFallbackShown() {
  return fallbacks;
}

// The number of page files downloading now. A number, so the snapshot is stable between renders.
export function usePagePending() {
  return useSyncExternalStore(subscribe, getPagePending, getPagePending);
}

function useFallbackShown() {
  return useSyncExternalStore(subscribe, getFallbackShown, getFallbackShown);
}

// True when the thin bar should show. A page file is downloading and an old page is on screen to keep.
// The download must also have taken longer than the delay. A quick load shows nothing so nothing flashes.
export function useLoadingBar() {
  // Both are read on every render, so the hooks are always called in the same order.
  const pendingNow = usePagePending() > 0;
  const fallbackNow = useFallbackShown() > 0;
  const waiting = pendingNow && !fallbackNow;
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setTimeout(() => setDelayed(true), LOADING_BAR_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setDelayed(false);
    };
  }, [waiting]);
  return waiting && delayed;
}

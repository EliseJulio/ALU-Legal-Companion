import { useCallback, useState } from 'react';

// How the side menu is shown on a wide screen: open, narrow (an icon with a short word) or hidden. It is kept on
// this device only. If storage is blocked the choice lasts until the page is closed.
const KEY = 'alc.sidebar';
// The width a person last chose. It lets Show menu bring that width back after a reload.
const WIDTH_KEY = 'alc.sidebar.width';
export const SIDEBAR_MODES = ['expanded', 'collapsed', 'hidden'];

export function readSidebar() {
  try {
    const saved = localStorage.getItem(KEY);
    return SIDEBAR_MODES.includes(saved) ? saved : 'expanded';
  } catch {
    return 'expanded';
  }
}

function readWidth() {
  try {
    return localStorage.getItem(WIDTH_KEY) === 'collapsed' ? 'collapsed' : 'expanded';
  } catch {
    return 'expanded';
  }
}

export function saveSidebar(mode) {
  try {
    if (mode === 'expanded') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
    if (mode === 'collapsed') localStorage.setItem(WIDTH_KEY, 'collapsed');
    else if (mode === 'expanded') localStorage.removeItem(WIDTH_KEY);
  } catch {
    // Blocked storage. The menu still changes.
  }
}

export function useSidebar() {
  const [mode, setModeState] = useState(readSidebar);
  const [lastShown, setLastShown] = useState(() => {
    const saved = readSidebar();
    return saved === 'hidden' ? readWidth() : saved;
  });

  const setMode = useCallback((next) => {
    if (next !== 'hidden') setLastShown(next);
    setModeState(next);
    saveSidebar(next);
  }, []);

  // Showing the menu again brings back the width it had before it was hidden.
  const show = useCallback(() => setMode(lastShown), [lastShown, setMode]);

  return { mode, setMode, show };
}

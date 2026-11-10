import { useCallback, useState } from 'react';

// The menu panel on a wide screen is either open or narrowed to its icons. The choice is kept on
// this device only. If storage is blocked the choice lasts until the page is closed.
const KEY = 'alc.menu';

export function readNarrow() {
  try {
    return localStorage.getItem(KEY) === 'narrow';
  } catch {
    return false;
  }
}

export function saveNarrow(narrow) {
  try {
    if (narrow) localStorage.setItem(KEY, 'narrow');
    else localStorage.removeItem(KEY);
  } catch {
    // Blocked storage. The menu still changes.
  }
}

// The narrow flag and a way to change it. The choice is saved as it is made.
export function useNarrowMenu() {
  const [narrow, setNarrowState] = useState(readNarrow);
  const setNarrow = useCallback((next) => {
    saveNarrow(next);
    setNarrowState(next);
  }, []);
  return [narrow, setNarrow];
}

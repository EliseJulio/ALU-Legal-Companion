// The theme is light, dark or system. System means follow the device. It is kept on this device
// only. If storage is blocked the choice lasts until the page is closed.
const KEY = 'alc.theme';
export const THEMES = ['light', 'dark', 'system'];

export function readTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    return THEMES.includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

// Light and dark are set on the page. System removes the setting so the device decides.
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}

export function saveTheme(theme) {
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Blocked storage. The page still changes.
  }
  applyTheme(theme);
}

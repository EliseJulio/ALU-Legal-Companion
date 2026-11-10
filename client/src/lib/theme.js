import { useEffect, useState } from 'react';

// The theme is light, dark or system. System means follow the device. It is kept on this device
// only. If storage is blocked the choice lasts until the page is closed.
const KEY = 'alc.theme';
export const THEMES = ['light', 'dark', 'system'];

// The order one press of the theme button moves through, and the name each mode is shown by.
const MODE_NAMES = { light: 'Light', dark: 'Dark', system: 'System' };

// The name the page shows for a theme. An unknown value is shown as System, as readTheme does.
export function themeName(theme) {
  return MODE_NAMES[theme] ?? MODE_NAMES.system;
}

// The theme after `theme` in the cycle Light, Dark, System, Light. An unknown value falls before
// Light, so it also gives Light.
export function nextTheme(theme) {
  const index = THEMES.indexOf(theme);
  return THEMES[(index + 1) % THEMES.length];
}

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

// Every theme control on the page hears this, so the top bar, the menu and the More sheet agree.
export const THEME_EVENT = 'alc-theme';

export function saveTheme(theme) {
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Blocked storage. The page still changes.
  }
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

// The theme as the page shows it now. It updates when any control changes it.
export function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const onChange = (event) => setTheme(event.detail);
    window.addEventListener(THEME_EVENT, onChange);
    return () => window.removeEventListener(THEME_EVENT, onChange);
  }, []);
  return theme;
}

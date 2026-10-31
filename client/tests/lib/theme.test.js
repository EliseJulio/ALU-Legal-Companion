import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readTheme, saveTheme, applyTheme, THEMES } from '@/lib/theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('theme', () => {
  it('offers light, dark and system', () => {
    expect(THEMES).toEqual(['light', 'dark', 'system']);
  });

  it('follows the device when nothing was chosen', () => {
    expect(readTheme()).toBe('system');
  });

  it('keeps a chosen theme and puts it on the page', () => {
    saveTheme('dark');
    expect(readTheme()).toBe('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    saveTheme('light');
    expect(readTheme()).toBe('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('removes the setting and the saved choice for system so the device decides', () => {
    saveTheme('dark');
    saveTheme('system');
    expect(readTheme()).toBe('system');
    expect(localStorage.getItem('alc.theme')).toBeNull();
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('ignores a saved value it does not know', () => {
    localStorage.setItem('alc.theme', 'purple');
    expect(readTheme()).toBe('system');
  });

  it('still changes the page when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => saveTheme('dark')).not.toThrow();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(readTheme()).toBe('system');
  });

  it('applies a theme without saving it', () => {
    applyTheme('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('alc.theme')).toBeNull();
  });
});

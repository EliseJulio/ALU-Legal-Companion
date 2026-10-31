import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '@/lib/useMediaQuery';

// A stand-in for window.matchMedia. `fire` changes the answer the way a resized window does.
function mockMatchMedia(initial) {
  const listeners = new Set();
  const list = {
    matches: initial,
    addEventListener: vi.fn((_, fn) => listeners.add(fn)),
    removeEventListener: vi.fn((_, fn) => listeners.delete(fn)),
  };
  window.matchMedia = vi.fn(() => list);
  return { list, listeners, fire(next) { list.matches = next; listeners.forEach((fn) => fn()); } };
}

const original = window.matchMedia;
afterEach(() => { window.matchMedia = original; });

describe('useMediaQuery', () => {
  it('starts with the answer of the screen', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1280px)'));
    expect(result.current).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1280px)');
  });

  it('follows the window when it is resized across the line', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1280px)'));
    expect(result.current).toBe(false);
    act(() => media.fire(true));
    expect(result.current).toBe(true);
    act(() => media.fire(false));
    expect(result.current).toBe(false);
  });

  it('stops listening when the page that used it goes away', () => {
    const media = mockMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1280px)'));
    expect(media.listeners.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it('says no when the browser cannot answer, so the narrow layout is used', () => {
    window.matchMedia = undefined;
    const { result } = renderHook(() => useMediaQuery('(min-width: 1280px)'));
    expect(result.current).toBe(false);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readSidebar, saveSidebar, useSidebar } from '@/lib/sidebar';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('readSidebar', () => {
  it('starts expanded', () => {
    expect(readSidebar()).toBe('expanded');
  });

  it('reads a saved mode', () => {
    saveSidebar('collapsed');
    expect(readSidebar()).toBe('collapsed');
  });

  it('ignores a value it does not know', () => {
    localStorage.setItem('alc.sidebar', 'sideways');
    expect(readSidebar()).toBe('expanded');
  });

  it('does not keep the default', () => {
    saveSidebar('collapsed');
    saveSidebar('expanded');
    expect(localStorage.getItem('alc.sidebar')).toBeNull();
  });

  it('survives blocked storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readSidebar()).toBe('expanded');
    spy.mockRestore();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => saveSidebar('hidden')).not.toThrow();
    set.mockRestore();
  });
});

describe('useSidebar', () => {
  it('hides and then shows again at the width it had', () => {
    const { result } = renderHook(() => useSidebar());
    act(() => result.current.setMode('collapsed'));
    act(() => result.current.setMode('hidden'));
    expect(result.current.mode).toBe('hidden');
    act(() => result.current.show());
    expect(result.current.mode).toBe('collapsed');
  });

  it('shows expanded when it was hidden from the start', () => {
    saveSidebar('hidden');
    const { result } = renderHook(() => useSidebar());
    expect(result.current.mode).toBe('hidden');
    act(() => result.current.show());
    expect(result.current.mode).toBe('expanded');
  });

  it('brings back the narrow width after a reload while hidden', () => {
    saveSidebar('collapsed');
    saveSidebar('hidden');
    const { result } = renderHook(() => useSidebar());
    expect(result.current.mode).toBe('hidden');
    act(() => result.current.show());
    expect(result.current.mode).toBe('collapsed');
  });

  it('forgets the narrow width once the menu is opened wide again', () => {
    saveSidebar('collapsed');
    saveSidebar('expanded');
    saveSidebar('hidden');
    const { result } = renderHook(() => useSidebar());
    act(() => result.current.show());
    expect(result.current.mode).toBe('expanded');
  });

  it('keeps the choice for the next visit', () => {
    const { result } = renderHook(() => useSidebar());
    act(() => result.current.setMode('hidden'));
    expect(localStorage.getItem('alc.sidebar')).toBe('hidden');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi } from '@/lib/useApi';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  global.fetch = fetchMock;
});

describe('useApi', () => {
  it('starts loading and then gives the data', async () => {
    fetchMock.mockResolvedValue(reply(200, [{ id: 1 }]));
    const { result } = renderHook(() => useApi('/guides'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 1 }]);
    expect(result.current.error).toBeNull();
  });

  it('gives the error when the request fails', async () => {
    fetchMock.mockResolvedValue(reply(500, { error: 'The database is down' }));
    const { result } = renderHook(() => useApi('/guides'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error.message).toBe('The database is down');
  });

  it('loads nothing for an empty path and does not stay loading', async () => {
    const { result } = renderHook(() => useApi(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads again when the path changes', async () => {
    fetchMock.mockImplementation(async (url) => reply(200, { url }));
    const { result, rerender } = renderHook(({ path }) => useApi(path), { initialProps: { path: '/one' } });
    await waitFor(() => expect(result.current.data?.url).toMatch(/\/one$/));
    rerender({ path: '/two' });
    await waitFor(() => expect(result.current.data?.url).toMatch(/\/two$/));
  });

  it('never hands out the answer to the old path, not even for one render', async () => {
    fetchMock.mockImplementation(async (url) => reply(200, { url }));
    const seen = [];
    const { result, rerender } = renderHook(({ path }) => {
      const out = useApi(path);
      seen.push({ path, data: out.data });
      return out;
    }, { initialProps: { path: '/one' } });
    await waitFor(() => expect(result.current.data?.url).toMatch(/\/one$/));
    seen.length = 0;
    rerender({ path: '/two' });
    await waitFor(() => expect(result.current.data?.url).toMatch(/\/two$/));
    // Every render for /two either has no data yet or has the data for /two.
    seen.filter((s) => s.path === '/two').forEach((s) => {
      if (s.data) expect(s.data.url).toMatch(/\/two$/);
    });
    expect(seen[0].data).toBeNull();
  });

  it('keeps what is shown while the same path loads again', async () => {
    let release;
    fetchMock
      .mockResolvedValueOnce(reply(200, { n: 1 }))
      .mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(reply(200, { n: 2 })); }));
    const { result } = renderHook(() => useApi('/count'));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toEqual({ n: 1 });
    act(() => release());
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
    expect(result.current.loading).toBe(false);
  });

  it('never hands out the answer to the old path for the new one', async () => {
    fetchMock.mockImplementation(async (url) => reply(200, { url }));
    const { result, rerender } = renderHook(({ path }) => useApi(path), { initialProps: { path: '/one' } });
    await waitFor(() => expect(result.current.data?.url).toMatch(/\/one$/));
    rerender({ path: '/two' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data?.url).toMatch(/\/two$/));
  });

  it('keeps what is on screen while the same path is loaded again', async () => {
    let release;
    fetchMock.mockResolvedValueOnce(reply(200, { n: 1 }))
      .mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(reply(200, { n: 2 })); }));
    const { result } = renderHook(() => useApi('/count'));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toEqual({ n: 1 });
    await act(async () => { release(); });
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
  });

  it('loads again when refetch is called', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { n: 1 })).mockResolvedValueOnce(reply(200, { n: 2 }));
    const { result } = renderHook(() => useApi('/count'));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

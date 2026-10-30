import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

// A small hook that loads a path when the page opens. It is not react-query on purpose. No
// server data is shared between pages here so a cache would be unused weight.
export function useApi(path) {
  // `path` is kept with the answer. When the path changes the old answer is not the answer to
  // the new question. So it is not handed out for even one render.
  const [state, setState] = useState({ path, data: null, error: null, loading: Boolean(path) });

  // `refetch` changes this number and the effect reads it. A page that acts on something
  // (publishes a guide for example) reloads the list from the server. It does not patch the row
  // itself. The server decides the new state and a local guess could differ from it.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // An empty path means "do not load anything". The page may not know yet who is asking.
    // A page that loaded anyway would send a request that gets a 401. A 401 clears the
    // saved login. Hooks cannot be called inside a condition so the condition is here.
    let cancelled = false;
    if (!path) return undefined;

    apiGet(path)
      .then((data) => { if (!cancelled) setState({ path, data, error: null, loading: false }); })
      .catch((error) => { if (!cancelled) setState({ path, data: null, error, loading: false }); });
    return () => { cancelled = true; };
  }, [path, nonce]);

  // The same function on every render, so a page can list it in a dependency array. This sets
  // loading itself because the effect only ever sets it to false when a fetch settles — without
  // this, a refetch would never show as loading at all.
  const refetch = useCallback(() => {
    setState((s) => (s.path === path ? { ...s, loading: true } : s));
    setNonce((n) => n + 1);
  }, [path]);

  // A new path has no answer yet, even in the render before the effect has run. Refetches retain
  // their prior result while loading in the background so an editor never unmounts mid-save.
  if (state.path !== path) return { data: null, error: null, loading: Boolean(path), refetch };
  const { data, error, loading } = state;
  return { data, error, loading, refetch };
}

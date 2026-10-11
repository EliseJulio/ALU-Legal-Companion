import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

// A small hook that loads a path when the page opens. It is not react-query on purpose. No
// server data is shared between pages here so a cache would be unused weight.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  // `refetch` changes this number and the effect reads it. A page that acts on something
  // (verifies a guide for example) reloads the list from the server. It does not patch the row
  // itself. The server decides the new state and a local guess could differ from it.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // An empty path means "do not load anything". The page may not know yet who is asking.
    // A page that loaded anyway would send a request that gets a 401. A 401 clears the
    // saved login. Hooks cannot be called inside a condition so the condition is here.
    // Even then it must settle. The page shows a spinner while `loading` is true, so
    // holding off must not look like loading for ever.
    const willFetch = Boolean(path);
    let cancelled = false;
    setState({ data: null, error: null, loading: willFetch });
    if (!willFetch) return undefined;

    apiGet(path)
      .then((data) => { if (!cancelled) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (!cancelled) setState({ data: null, error, loading: false }); });
    return () => { cancelled = true; };
  }, [path, nonce]);

  // The same function on every render, so a page can list it in a dependency array.
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, refetch };
}

import { useEffect, useState } from 'react';

// True while the screen matches a CSS media query, for example '(min-width: 1280px)'. A page uses it
// when it draws a different layout for a wide screen and not the same content twice. A browser that
// cannot answer gets false, so the narrow layout is used.
export function useMediaQuery(query) {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [matches, setMatches] = useState(() => supported && window.matchMedia(query).matches);

  useEffect(() => {
    if (!supported) return undefined;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query, supported]);

  return matches;
}

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// A link may end in #name. Once the page is ready this scrolls to the element marked data-anchor="name".
// It moves focus there and marks the element for a moment so the eye finds it.
// A row can exist twice (a table and cards) so the copy that is on screen is used.
export function useScrollToHash(ready) {
  const { hash, key } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return undefined;
    const name = decodeURIComponent(hash.slice(1));
    const matches = [...document.querySelectorAll('[data-anchor]')].filter((el) => el.dataset.anchor === name);
    const target = matches.find((el) => el.getClientRects().length > 0) ?? matches[0];
    if (!target) return undefined;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
    target.setAttribute('data-flash', '');
    const timer = setTimeout(() => target.removeAttribute('data-flash'), 2200);
    return () => {
      clearTimeout(timer);
      target.removeAttribute('data-flash');
    };
  }, [ready, hash, key]);
}

// Full screen for one element.
// Where the browser cannot do it (iPhone Safari) the element fills the page instead.
import { useCallback, useEffect, useState } from 'react';

export function useFullscreen(ref) {
  const [native, setNative] = useState(false);
  const [pageFill, setPageFill] = useState(false);

  useEffect(() => {
    const onChange = () => setNative(Boolean(ref.current) && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [ref]);

  useEffect(() => {
    if (!pageFill) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPageFill(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pageFill]);

  const toggle = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (pageFill) {
      setPageFill(false);
      return;
    }
    if (document.fullscreenEnabled && el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // The browser refused. The page-filling mode below is used instead.
      }
    }
    setPageFill(true);
  }, [ref, pageFill]);

  return { full: native || pageFill, pageFill, toggle };
}

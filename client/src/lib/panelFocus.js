import { useEffect, useRef } from 'react';

// Focus for a question or panel that replaces the control which opened it. When it opens, focus goes
// to `firstRef`. When it closes, focus goes back to `openerRef`, the control that was pressed. A close
// by any other route, such as a sent request, leaves focus where the page put it.
export function usePanelFocus(open) {
  const firstRef = useRef(null);
  const openerRef = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      firstRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      openerRef.current?.focus();
    }
  }, [open]);

  return { firstRef, openerRef };
}

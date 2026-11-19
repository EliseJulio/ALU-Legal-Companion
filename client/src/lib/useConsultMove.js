import { useCallback, useEffect, useRef, useState } from 'react';

// What a screen reader hears after a lawyer acts on a consultation.
const SAID = {
  accepted: 'Consultation accepted',
  declined: 'Consultation declined',
  completed: 'Consultation marked as completed',
  proposed: 'Suggestion sent. Waiting for the person.',
};

// How long the moved row is waited for. A reload that fails never changes the rows, so after this
// the mark is dropped and a later update cannot move focus.
const WAIT_MS = 20000;

// After an action the row moves to another list, so the element that had focus is gone. The page
// keeps one status line and, once the list has been loaded again, moves focus to the moved row.
export function useConsultMove(refetch, rows) {
  const [message, setMessage] = useState('');
  const moved = useRef(null);
  const timer = useRef(null);

  const onDone = useCallback((status, id) => {
    setMessage(SAID[status] ?? '');
    moved.current = id;
    clearTimeout(timer.current);
    const forget = () => { if (moved.current === id) moved.current = null; };
    timer.current = setTimeout(forget, WAIT_MS);
    // A refetch that hands back a promise is also forgotten once it settles, failed or not.
    // The short delay lets the new rows be shown, and focused, first.
    const pending = refetch();
    if (typeof pending?.finally === 'function') pending.finally(() => setTimeout(forget, 0)).catch(() => {});
  }, [refetch]);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (moved.current === null) return;
    const row = document.querySelector(`[data-anchor="consult-${moved.current}"]`);
    moved.current = null;
    row?.focus();
  }, [rows]);

  return { message, onDone };
}

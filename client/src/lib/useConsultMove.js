import { useCallback, useEffect, useRef, useState } from 'react';

// What a screen reader hears after a lawyer acts on a consultation.
const SAID = {
  accepted: 'Consultation accepted',
  declined: 'Consultation declined',
  completed: 'Consultation marked as completed',
  proposed: 'Suggestion sent. Waiting for the person.',
};

// After an action the row moves to another list, so the element that had focus is gone. The page
// keeps one status line and, once the list has been loaded again, moves focus to the moved row.
export function useConsultMove(refetch, rows) {
  const [message, setMessage] = useState('');
  const moved = useRef(null);

  const onDone = useCallback((status, id) => {
    setMessage(SAID[status] ?? '');
    moved.current = id;
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (moved.current === null) return;
    const row = document.querySelector(`[data-anchor="consult-${moved.current}"]`);
    moved.current = null;
    row?.focus();
  }, [rows]);

  return { message, onDone };
}

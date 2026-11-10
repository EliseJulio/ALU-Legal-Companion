import { useState } from 'react';

// The moment the page was opened. It is read once, so the figures on a page do not shift between two
// renders of the same screen. A page opened yesterday and left open does not count yesterday's deadlines
// as today's until it is opened again.
export function useNow() {
  const [now] = useState(() => new Date());
  return now;
}

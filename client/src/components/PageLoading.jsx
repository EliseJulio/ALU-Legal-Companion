import { useEffect, useState } from 'react';
import { holdFallback } from '@/lib/pagePending';

// The plain Loading area. It shows only on the first render when no page is on screen yet.
// After that the old page stays up while the next one downloads. The thin bar in Layout says so.
// The status region is on screen empty from the first frame. Its words are added a moment later.
// A screen reader announces a change to a live region but not what a new one starts with.
// The sighted message waits 150 ms so a fast load shows nothing.
// The block has a fixed minimum height so the footer does not jump when the page arrives.
export default function PageLoading() {
  const [announced, setAnnounced] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Tells the shell that this Loading area is on screen, so it does not add a bar on top of it.
    const release = holdFallback();
    const first = setTimeout(() => setAnnounced(true), 50);
    const second = setTimeout(() => setVisible(true), 150);
    return () => { release(); clearTimeout(first); clearTimeout(second); };
  }, []);
  return (
    <div data-page-loading className="min-h-[40vh]">
      <div role="status" className="sr-only">{announced ? 'Loading' : ''}</div>
      {visible && <p aria-hidden="true" className="text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
}

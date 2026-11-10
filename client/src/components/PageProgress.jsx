import { useEffect, useState } from 'react';

// The thin bar under the top bar. It shows while the next page downloads.
// It is 3 px high and spans the page area. It is hidden from screen readers.
// The sweep is in index.css. It stands still when the person asks for reduced motion.
//
// The words "Loading page" go in a polite status region.
// The region is added empty and its words follow a moment later.
// A screen reader announces a change to a live region but not what a new one starts with.
// The region is on the page only while the bar is. The page keeps one status region of its own at other times.
export default function PageProgress({ show }) {
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    if (!show) return undefined;
    const timer = setTimeout(() => setAnnounced(true), 50);
    return () => {
      clearTimeout(timer);
      setAnnounced(false);
    };
  }, [show]);
  if (!show) return null;
  return (
    <>
      <p role="status" className="sr-only">{announced ? 'Loading page' : ''}</p>
      <div aria-hidden="true" data-page-progress className="page-progress h-[3px] w-full shrink-0 overflow-hidden bg-primary-subtle">
        <span className="page-progress-sweep" />
      </div>
    </>
  );
}

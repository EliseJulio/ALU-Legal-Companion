// A status as a word in a pill. What it means is in the text and never in the colour alone.
// The pill reads the same in greyscale and to a screen reader. The stored code is never shown.
// A reader sees "Open" and not a database value. The words live here so two pages cannot call
// the same state by two names. Later slices add their own states to this list.
const PHRASES = {
  // matters
  open: 'Open',
  closed: 'Finished',
  // bookings
  requested: 'Requested',
  accepted: 'Accepted',
  declined: 'Declined',
  completed: 'Completed',
};

export default function StatusPill({ status }) {
  // Nothing at all is better than an empty pill. It would look like a value that failed to load.
  if (!status) return null;
  // An unknown status is shown as it is. That is clumsy but better than a blank or a crash.
  const phrase = PHRASES[String(status).toLowerCase()] ?? status;

  return (
    <span className="inline-flex items-center rounded-full border border-border bg-canvas 
    px-3 py-1 text-xs font-semibold text-ink">
      {phrase}
    </span>
  );
}

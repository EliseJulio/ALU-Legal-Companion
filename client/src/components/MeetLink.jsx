import { RING } from '@/lib/ui';

function safeHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

// How a confirmed appointment happens. The server sends `meet_link` only for an accepted
// booking. So this component does not decide when a room may be shown. It does handle the case
// where the booking is accepted and the lawyer set up no room. Saying nothing there would leave
// a confirmed appointment that nobody can attend.
export default function MeetLink({ booking, className = '' }) {
  if (!booking || booking.status !== 'accepted') return null;

  // The server only saves a Google Meet address. The page checks again before it makes a link.
  // A value such as javascript:... would run code when clicked. Anything that is not https is
  // treated as no room.
  const room = safeHttps(booking.meet_link);

  if (!room) {
    return (
      <div className={`rounded border border-warning-border bg-warning-subtle p-4 ${className}`}>
        <p className="font-medium text-warning-strong">No video room has been set up for this appointment yet.</p>
        <p className="mt-1 text-sm">
          The time is confirmed but the lawyer has not added a meeting link. Check again shortly
          before the appointment. If there is still nothing, use the contact details in the
          directory.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded border border-border bg-surface p-4 ${className}`}>
      <p className="text-xs font-medium text-muted-foreground">How to join</p>
      <a
        href={room}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-2 inline-flex min-h-touch items-center rounded bg-primary px-4 font-head font-semibold text-primary-foreground ${RING}`}
      >
        Join the video call ↗
      </a>
      {/* The full address is shown too. Someone joining from another device needs to copy it. */}
      <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{room}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        You may wait in a waiting area until the lawyer lets you in. 
        That is on purpose. It keeps each consultation private.
      </p>
    </div>
  );
}

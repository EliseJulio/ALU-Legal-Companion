import { CARD } from '@/lib/ui';
import JoinCallLink from '@/components/JoinCallLink';

// How a confirmed appointment happens. The server sends `meet_link` only for an accepted booking.
// The page the link opens decides whether the call starts in the platform or falls back to that Meet link.
// So this card never shows the Meet address itself. It shows a link to the join page.
// anonCode is passed only by the booking check page.
export default function MeetLink({ booking, anonCode, className = '' }) {
  if (!booking || booking.status !== 'accepted') return null;

  return (
    <div className={`${CARD} ${className}`}>
      <p className="text-xs font-medium text-muted-foreground">How to join</p>
      <JoinCallLink booking={booking} anonCode={anonCode} className="mt-2" />
      <p className="mt-3 text-sm text-muted-foreground">
        You may wait in a waiting area until the lawyer lets you in.
        That is on purpose. It keeps each consultation private.
      </p>
    </div>
  );
}

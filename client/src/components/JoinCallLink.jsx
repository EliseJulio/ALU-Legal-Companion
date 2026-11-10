import { Link } from 'react-router-dom';
import { BUTTON_PRIMARY } from '@/lib/ui';
import { canJoin } from '@/lib/appointments';

// The way into the call for an accepted booking. It links to the join page. The room is made and
// the camera or microphone is used only after the person presses Join on that page. Nothing here
// contacts another site.
// anonCode is the anonymous booking code. It travels in the router state, never in the address.
export default function JoinCallLink({ booking, anonCode, className = '' }) {
  if (canJoin(booking) && booking.id) {
    return (
      <Link
        to={`/call/${booking.id}`}
        state={anonCode ? { code: anonCode } : undefined}
        className={`${BUTTON_PRIMARY} ${className} w-full sm:w-auto`}
      >
        Join the call
      </Link>
    );
  }
  return null;
}

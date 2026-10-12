import { useState } from 'react';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import { readableSlot } from '@/lib/bookings';
import { PANEL, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

// What an expert can do next with a booking. It only moves forward.
const NEXT = {
  requested: [['accepted', 'Accept this time', true], ['declined', 'Decline', false]],
  accepted: [['completed', 'Mark as completed', true], ['declined', 'Decline', false]],
};

function BookingActions({ booking, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const actions = NEXT[booking.status] ?? [];
  if (actions.length === 0) return null;

  async function move(status) {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/bookings/${booking.id}/status`, { status });
      onDone();
    } catch (err) {
      // For example "you already have an accepted booking at that time".
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-3">
        {actions.map(([status, label, primary]) => (
          <button key={status} type="button" disabled={busy} className={primary ? BUTTON_PRIMARY : BUTTON_OUTLINE} onClick={() => move(status)}>
            {label}
          </button>
        ))}
      </div>
      {error && <ErrorNotice error={error} className="mt-2" />}
    </div>
  );
}

// The bookings for the directory entry linked to this expert's account. The requester is printed
// exactly as the server sends it. That is "Anonymous" for an anonymous booking. Otherwise it is
// the person's name. The page does not reformat it or add anything.
export default function ExpertBookings() {
  const { data: bookings, error, loading, refetch } = useApi('/bookings/expert');

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Appointments</h1>
      <p className="mt-1 text-muted-foreground">Requests for a time with you, soonest first.</p>

      {/* The same video room is reused for every consultation. Anyone who ever held the link can
          open it later. Asking to admit each person is the whole protection. */}
      <p className={`mt-4 text-sm ${PANEL}`}>
        Your video room is the same for every appointment. Keep “host must admit” switched on so
        nobody can join a private consultation by mistake.
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {bookings?.length === 0 && (
        <p className={`mt-6 text-muted-foreground ${PANEL}`}>
          No requests yet. If you expected some, ask an administrator to check that your account is
          linked to your directory entry.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {bookings?.map((booking) => (
          <li key={booking.id} className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-head font-semibold text-primary">{readableSlot(booking.slot) ?? 'Time not available'}</p>
              <StatusPill status={booking.status} />
            </div>
            <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Requested by</dt>
              <dd className="font-medium">{booking.requester}</dd>
              {booking.topic && (<><dt className="text-muted-foreground">About</dt><dd>{booking.topic}</dd></>)}
            </dl>
            {/* An accepted appointment with no room cannot be attended. Saying so now is better
                than finding out when nobody turns up. */}
            {booking.status === 'accepted' && !booking.meet_link && (
              <p className="mt-2 text-sm font-semibold text-warning-strong">
                No video room is set for you yet, so the person cannot join. Ask an administrator to add one.
              </p>
            )}
            <BookingActions booking={booking} onDone={refetch} />
          </li>
        ))}
      </ul>
    </div>
  );
}

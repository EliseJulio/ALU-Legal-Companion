import { useState } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import { readableSlot } from '@/lib/bookings';
import { secureAddress } from '@/lib/url';
import { PANEL, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

// What an expert can do next with a booking. It only moves forward.
const NEXT = {
  requested: [['accepted', 'Accept this time', true], ['declined', 'Decline', false]],
  accepted: [['completed', 'Mark as completed', true], ['declined', 'Decline', false]],
};

function BookingActions({ booking, onDone }) {
  const when = readableSlot(booking.slot) ?? 'this request';
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
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {actions.map(([status, label, primary]) => (
          <button key={status} type="button" aria-disabled={busy || undefined} className={primary ? BUTTON_PRIMARY : BUTTON_OUTLINE} onClick={() => move(status)}>
            <span>{label}{' '}<span className="sr-only">for {when}</span></span>
          </button>
        ))}
      </div>
      {error && <ErrorNotice error={error} className="mt-2" />}
    </div>
  );
}

// One booking. The requester is printed exactly as the server sends it. That is "Anonymous" for
// an anonymous booking. Otherwise it is the person's name. The page does not reformat it.
function BookingCard({ booking, onDone }) {
  const room = secureAddress(booking.meet_link);
  return (
    <li className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-sans font-semibold text-primary">{readableSlot(booking.slot) ?? 'Time not available'}</p>
        <StatusPill status={booking.status} />
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Requested by</dt>
        <dd className="font-medium">{booking.requester}</dd>
        {booking.topic && (<><dt className="text-muted-foreground">About</dt><dd>{booking.topic}</dd></>)}
      </dl>
      {booking.status === 'accepted' && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meeting</p>
          {room ? (
            <a href={room} target="_blank" rel="noopener noreferrer" className={`${BUTTON_OUTLINE} mt-2`}>
              <span>Open the meeting<span aria-hidden="true">&nbsp;↗</span>{' '}<span className="sr-only">(opens in a new tab)</span></span>
            </a>
          ) : (
            // An accepted appointment with no room cannot be attended. Saying so now is better
            // than finding out when nobody turns up.
            <p className="mt-1 text-sm font-semibold text-warning-strong">
              No video room is set for you yet, so the person cannot join. Ask an administrator to add one.
            </p>
          )}
        </div>
      )}
      <BookingActions booking={booking} onDone={onDone} />
    </li>
  );
}

function Group({ id, title, note, bookings, empty, onDone, className = '', before = null }) {
  return (
    <section aria-labelledby={id} className={`min-w-0 ${className}`}>
      <h2 id={id} className="font-head text-2xl leading-heading text-primary">{title}</h2>
      {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
      {before}
      {bookings.length === 0 ? (
        <p className={`mt-3 text-sm text-muted-foreground ${PANEL}`}>{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {bookings.map((booking) => <BookingCard key={booking.id} booking={booking} onDone={onDone} />)}
        </ul>
      )}
    </section>
  );
}

// The bookings for the directory entry linked to this expert's account, in three groups. The
// groups stay in the order requested, accepted, earlier in the page, and a wide screen puts the
// accepted ones in a column of their own.
export default function ExpertBookings() {
  const { data: bookings, error, loading, refetch } = useApi('/bookings/expert');
  const of = (...statuses) => bookings?.filter((b) => statuses.includes(b.status)) ?? [];

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Expert workspace' }]} current="Appointments" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Your consultation requests.</h1>
      <p className="mt-3 max-w-reading text-muted-foreground">Only requests for your linked provider. Soonest requested time first.</p>

      {loading && !bookings && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {bookings?.length === 0 && (
        <p className={`mt-6 text-muted-foreground ${PANEL}`}>
          No requests yet. If you expected some, ask an administrator to check that your account is
          linked to your directory entry.
        </p>
      )}

      {bookings?.length > 0 && (
        <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
          <Group
            id="pending-heading"
            title="Pending requests"
            note="Review incoming requests for your linked listing. When you accept, a person who signed in is emailed the time and your meeting link. A person who asked anonymously has no address and checks with their code."
            bookings={of('requested')}
            empty="No requests are waiting for you."
            onDone={refetch}
            className="xl:col-start-1 xl:row-start-1"
          />
          <Group
            id="accepted-heading"
            title="Accepted appointments"
            note="Meeting access and completion for what you accepted."
            bookings={of('accepted')}
            empty="Nothing here yet."
            onDone={refetch}
            className="xl:col-start-2 xl:row-span-2 xl:row-start-1"
            before={(
              // The same video room is reused for every consultation. Anyone who ever held the link
              // can open it later. Asking to admit each person is the whole protection. It comes
              // first because it is about every meeting link below.
              <Callout title="Host admission required" className="mt-3">
                Your video room is the same for every appointment. Keep “host must admit” switched on
                so nobody can join a private consultation by mistake.
              </Callout>
            )}
          />
          <Group
            id="earlier-heading"
            title="Earlier requests"
            bookings={of('completed', 'declined')}
            empty="Nothing here yet."
            onDone={refetch}
            className="xl:col-start-1 xl:row-start-2"
          />
        </div>
      )}
    </div>
  );
}

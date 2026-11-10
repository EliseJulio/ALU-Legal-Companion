import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import ErrorNotice from '@/components/ErrorNotice';
import Breadcrumb from '@/components/Breadcrumb';
import StatusPill from '@/components/StatusPill';
import MeetLink from '@/components/MeetLink';
import { readableSlot, bookingStatusStep } from '@/lib/bookings';
import { FORM_FIELD, BUTTON_LG_PRIMARY, BUTTON_DISABLED, BUTTON_OUTLINE, BUTTON_TEXT, PAGE_TITLE, CARD } from '@/lib/ui';

// Check an anonymous booking with its code. The code is kept in state and goes only into the
// path of one request. It is never put in the address bar. The code alone opens the booking.
// In the address it would stay in history and could be sent on to the next site.
// The server accepts any case and spaces and hyphens. So the page sends what was typed.
export default function CheckBooking() {
  const [code, setCode] = useState('');
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [looking, setLooking] = useState(false);

  async function lookUp(event) {
    event.preventDefault();
    const typed = code.trim();
    if (!typed) {
      setBooking(null);
      setError({ message: 'Type the code you were given when you booked.' });
      return;
    }
    setError(null);
    setLooking(true);
    try {
      setBooking(await apiGet(`/bookings/anon/${encodeURIComponent(typed)}`, { anonymous: true }));
    } catch (err) {
      setBooking(null);
      setError(err);
    } finally {
      setLooking(false);
    }
  }

  const step = booking ? bookingStatusStep(booking.status) : null;

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Directory', to: '/directory' }]} current="Check your booking" />
      <p className="mt-6 text-sm font-semibold text-muted-foreground">Check your request</p>
      <h1 className={`mt-1 ${PAGE_TITLE}`}>Check your booking</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">
        Type the code you were given when you booked. We cannot look a booking up by name because
        we never stored one. Anonymous requests are not added to My activity.
      </p>

      <form onSubmit={lookUp} className={`mt-6 max-w-form ${CARD}`}>
        <label htmlFor="booking-code" className="block text-sm font-semibold">Your booking code</label>
        <input
          id="booking-code"
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setBooking(null); }}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className={`${FORM_FIELD} font-mono`}
        />
        <button
          type="submit"
          aria-disabled={looking || undefined}
          className={`mt-6 w-full ${looking ? BUTTON_DISABLED : BUTTON_LG_PRIMARY}`}
        >
          {looking ? 'Looking…' : 'Check booking'}
        </button>
        <p className="mt-3 text-sm text-muted-foreground">Keep the code private. It grants access to this request. Lost codes cannot be recovered or reissued.</p>
      </form>

      {error && <ErrorNotice error={error} className="mt-4" />}
      {error?.status === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Try again when you have a connection. Keep the code you already saved.</p>
      )}

      {/* Always on the page so the result is read out when it arrives. */}
      <div role="status">
      {booking && (
        <section className={`mt-4 ${CARD}`} aria-labelledby="booking-heading">
          <StatusPill status={booking.status} />
          <h2 id="booking-heading" className="mt-2 font-head text-[20px] leading-[1.25] text-ink">{step.heading}</h2>
          <p className="mt-1 text-sm">{step.body}</p>
          <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">With</dt>
            <dd className="font-medium">{booking.provider_name}</dd>
            <dt className="text-muted-foreground">Time</dt>
            <dd className="font-medium">{readableSlot(booking.slot) ?? 'Not available'}</dd>
            {booking.topic && (<><dt className="text-muted-foreground">About</dt><dd>{booking.topic}</dd></>)}
          </dl>
          <MeetLink booking={booking} anonCode={code.trim()} className="mt-4" />
          {step.next && (
            <Link to="/directory" className={`mt-4 ${BUTTON_OUTLINE}`}>
              {step.next}
            </Link>
          )}
        </section>
      )}
      </div>

      <p className="mt-4 text-sm">
        <Link to="/directory" className={BUTTON_TEXT}>Back to the directory</Link>
      </p>
    </div>
  );
}

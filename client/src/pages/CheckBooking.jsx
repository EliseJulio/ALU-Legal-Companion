import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import ErrorNotice from '@/components/ErrorNotice';
import MeetLink from '@/components/MeetLink';
import { readableSlot, bookingStatusStep } from '@/lib/bookings';
import { RING, FIELD } from '@/lib/ui';

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
      setError({ message: 'Type the code you were given when you booked.' });
      return;
    }
    setError(null);
    setBooking(null);
    setLooking(true);
    try {
      setBooking(await apiGet(`/bookings/anon/${encodeURIComponent(typed)}`, { anonymous: true }));
    } catch (err) {
      setError(err);
    } finally {
      setLooking(false);
    }
  }

  const step = booking ? bookingStatusStep(booking.status) : null;

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Check your booking</h1>
      <p className="mt-1 text-muted-foreground">
        Type the code you were given when you booked. We cannot look a booking up by name because
        we never stored one.
      </p>

      <form onSubmit={lookUp} className="mt-4 rounded border border-border bg-surface p-4">
        <label htmlFor="booking-code" className="block text-sm font-medium">Your code</label>
        <input
          id="booking-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          spellCheck="false"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className={`${FIELD} font-mono`}
        />
        <button
          type="submit"
          disabled={looking}
          className={`mt-3 inline-flex min-h-touch items-center rounded px-4 font-head 
            font-semibold text-primary-foreground ${RING} ${looking ? 'bg-disabled' : 'bg-primary'}`}
        >
          {looking ? 'Looking…' : 'Check my booking'}
        </button>
      </form>

      {error && <ErrorNotice error={error} className="mt-4" />}

      {booking && (
        <section className="mt-4 rounded border border-border bg-surface p-4" aria-labelledby="booking-heading">
          <h2 id="booking-heading" className="font-head text-lg font-semibold text-primary">{step.heading}</h2>
          <p className="mt-1 text-sm">{step.body}</p>
          <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">With</dt>
            <dd className="font-medium">{booking.provider_name}</dd>
            <dt className="text-muted-foreground">Time</dt>
            <dd className="font-medium">{readableSlot(booking.slot) ?? 'Not available'}</dd>
            {booking.topic && (<><dt className="text-muted-foreground">About</dt><dd>{booking.topic}</dd></>)}
          </dl>
          <MeetLink booking={booking} className="mt-4" />
          {step.next && (
            <Link to="/directory" className={`mt-4 inline-flex min-h-touch items-center rounded 
            border border-primary px-4 font-head text-sm font-semibold text-primary ${RING}`}>
              {step.next}
            </Link>
          )}
        </section>
      )}

      <p className="mt-4 text-sm">
        <Link to="/directory" className={`inline-flex min-h-touch items-center font-semibold text-primary underline ${RING}`}>
          Back to the directory
        </Link>
      </p>
    </div>
  );
}

import { Link } from 'react-router-dom';
import VerifiedStamp from '@/components/VerifiedStamp';
import { typeLabel } from '@/lib/directory';
import { readableDay } from '@/lib/dates';
import { RING } from '@/lib/ui';

// One lawyer, consultant or organisation. It is a list item so the page puts it inside a ul.
export default function ProviderCard({ provider }) {
  const {
    id, name, type, location, contact, services, bookable, languages, is_free: isFree,
    last_checked_at: lastChecked, stale, verified_by_name: verifiedBy, verified_at: verifiedAt,
  } = provider;
  const checked = readableDay(lastChecked);

  return (
    <li className="rounded border border-border bg-surface p-4">
      <h3 className="font-head font-semibold text-primary">{name}</h3>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
        {typeLabel(type)}
        {location ? ` · ${location}` : ''}
      </p>
      {services && <p className="mt-2 text-sm">{services}</p>}

      {/* How to reach it, the languages and the cost. These are what a reader needs before they
          call. They are words and never an icon alone. */}
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        {contact && (<><dt className="text-muted-foreground">How to reach it</dt>
        <dd className="font-medium">{contact}</dd></>)}
        {languages && (<><dt className="text-muted-foreground">Languages</dt>
        <dd>{languages}</dd></>)}
        <dt className="text-muted-foreground">Cost</dt>
        <dd>{isFree ? 'Free' : 'May charge a fee. Ask first.'}</dd>
      </dl>

      {bookable ? (
        <Link
          to={`/directory/book/${id}`}
          className={`mt-3 inline-flex min-h-touch items-center rounded 
            bg-primary px-4 font-head text-sm font-semibold text-primary-foreground ${RING}`}
        >
          Request a booking
        </Link>
      ) : (
        // No link on purpose. The server refuses a booking for an entry that is not bookable.
        // A link would lead the reader straight to an error.
        <p className="mt-3 text-sm text-muted-foreground">
          This office does not take online bookings. Contact them directly or walk in.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <VerifiedStamp name={verifiedBy} date={verifiedAt} />
        {checked && <span>Details last checked {checked}</span>}
        {/* An old entry may still be right. Saying so plainly helps more than hiding it. */}
        {stale && <span className="font-semibold text-warning-strong">Not re-checked for over 
          six months. Confirm by phone first.</span>}
      </div>
    </li>
  );
}

import { Link } from 'react-router-dom';
import MapCard from '@/components/MapCard';
import { typeLabel } from '@/lib/directory';
import { readableDay } from '@/lib/dates';
import { secureAddress } from '@/lib/url';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, RING_ON_CANVAS } from '@/lib/ui';

// A contact line is plain text. A full https address in it becomes a link that opens in a new tab.
// It is for an office that books on its own calendar. Nothing loads until the reader presses it.
function contactParts(contact, name) {
  return contact.split(/(https:\/\/\S+)/).map((part, i) => {
    const href = secureAddress(part);
    if (!href) return part;
    return (
      <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={`font-semibold text-primary underline ${RING_ON_CANVAS}`}>
        Book a session{' '}<span className="sr-only">with {name} (opens in a new tab)</span>
      </a>
    );
  });
}

// One lawyer, consultant or organisation. It is a list item so the page puts it inside a ul.
// `bare` leaves out the name and the type line for a page that already shows them above.
// `noBooking` leaves out the booking button and its line for a page that has its own.
export default function ProviderCard({ provider, bare = false, noBooking = false }) {
  const {
    id, name, type, location, contact, services, bookable, languages, is_free: isFree,
    address, hours, address_note: addressNote,
    last_checked_at: lastChecked, stale,
  } = provider;
  const checked = readableDay(lastChecked);

  return (
    <li className={`border border-border bg-surface p-6 ${bare ? 'rounded-b-card' : 'rounded-card'}`}>
      {!bare && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="font-head text-2xl leading-heading text-primary">
              <Link to={`/directory/${id}`} className={`inline-block py-2 hover:underline ${RING_ON_CANVAS}`}>{name}</Link>
            </h3>
            {/* Words, not colour, say whether a booking can be asked for here. */}
            {bookable ? (
              <span className="rounded-pill border border-info bg-primary-subtle px-2.5 py-1 text-xs font-semibold text-info">Bookings open</span>
            ) : (
              <span className="rounded-pill border border-border bg-badge px-2.5 py-1 text-xs font-semibold text-muted-foreground">Contact directly</span>
            )}
          </div>
          <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
            {typeLabel(type)}
            {location ? ` · ${location}` : ''}
          </p>
        </>
      )}
      {services && <p className={bare ? 'text-sm' : 'mt-2 text-sm'}>{services}</p>}

      {/* How to reach it, the languages and the cost. These are what a reader needs before they
          call. They are words and never an icon alone. */}
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        {address && (<><dt className="text-muted-foreground">Address</dt>
        <dd>{address}<MapCard name={name} address={address} /></dd></>)}
        {hours && (<><dt className="text-muted-foreground">Opening hours</dt>
        <dd>{hours}</dd></>)}
        {addressNote && (<><dt className="text-muted-foreground">Good to know</dt>
        <dd>{addressNote}</dd></>)}
        {contact && (<><dt className="text-muted-foreground">How to reach it</dt>
        <dd className="font-medium">{contactParts(contact, name)}</dd></>)}
        {languages && (<><dt className="text-muted-foreground">Languages</dt>
        <dd>{languages}</dd></>)}
        <dt className="text-muted-foreground">Cost</dt>
        <dd>{isFree ? 'Free' : 'May charge a fee. Ask first.'}</dd>
      </dl>

      {!noBooking && (bookable ? (
        <Link to={`/directory/book/${id}`} className={`mt-4 w-full sm:w-auto ${BUTTON_PRIMARY}`}>
          Request consultation{' '}<span className="sr-only">with {name}</span>
        </Link>
      ) : (
        // No link on purpose. The server refuses a booking for an entry that is not bookable.
        // A link would lead the reader straight to an error.
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            This office does not take online bookings. Contact them directly or walk in.
          </p>
          {/* The full listing has the hours and the map. A list card leads to it. A page that is the
              listing, or has its own way there, leaves the button out. */}
          {!bare && (
            <Link to={`/directory/${id}`} className={`mt-4 w-full sm:w-auto ${BUTTON_OUTLINE}`}>
              Expand listing{' '}<span className="sr-only">for {name}</span>
            </Link>
          )}
        </>
      ))}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {checked && <span>Details last checked {checked}</span>}
        {/* An old entry may still be right. Saying so plainly helps more than hiding it. */}
        {stale && <span className="font-semibold text-warning-strong">Not re-checked for over 
          six months. Confirm by phone first.</span>}
      </div>
    </li>
  );
}

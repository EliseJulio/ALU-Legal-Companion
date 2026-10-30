import { Link, useParams } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ProviderCard from '@/components/ProviderCard';
import { typeLabel } from '@/lib/directory';
import { secureAddress } from '@/lib/url';
import { readableDay } from '@/lib/dates';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_TEXT, PANEL } from '@/lib/ui';

// One directory listing in full. The server sends it only when an admin has checked and published it.
// The booking and the contact details have a panel each, so the card leaves its own booking out.
export default function ProviderDetail() {
  const { id } = useParams();
  const { data: p, error, loading } = useApi(`/directory/providers/${id}`);

  if (loading) return <p role="status" className="text-muted-foreground">Loading…</p>;
  if (error) {
    return (
      <div>
        <h1 className="font-head text-4xl leading-heading text-primary">This listing is not available</h1>
        <ErrorNotice error={error} className="mt-4" />
        <p className="mt-4"><Link to="/directory" className={BUTTON_TEXT}>Back to the directory</Link></p>
      </div>
    );
  }

  // Only a full https address becomes a link. A stored javascript: value would run when clicked.
  const source = secureAddress(p.official_source_url);
  const checked = readableDay(p.last_checked_at);

  return (
    <article>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Directory', to: '/directory' }]} current={p.name} />
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {typeLabel(p.type)}{p.location ? ` · ${p.location}` : ''}
      </p>
      <h1 className="mt-3 font-head text-4xl leading-heading text-primary md:text-5xl">{p.name}</h1>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <ul><ProviderCard provider={p} bare noBooking /></ul>

          {/* The panel exists only where a request can be made. An office that takes no online
              bookings has nothing to request and nothing to check, so it gets one plain line. */}
          {p.bookable ? (
            <section className={PANEL} aria-labelledby="consult-heading">
              <h2 id="consult-heading" className="font-head text-2xl leading-heading text-primary">Consultation requests</h2>
              <p className="mt-2 text-sm">Suggest a date and time. Your request is not confirmed until the expert accepts.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-card border border-border bg-canvas p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking</h3>
                  <Link to={`/directory/book/${p.id}`} className={`${BUTTON_PRIMARY} w-full`}>
                    Request consultation{' '}<span className="sr-only">with {p.name}</span>
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Anonymous requests do not require your name or email. Keep the one-time retrieval code.
                  </p>
                </div>
                <div className="flex flex-col gap-3 rounded-card border border-border bg-canvas p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Retrieval</h3>
                  <Link to="/directory/booking-check" className={`${BUTTON_OUTLINE} w-full`}>Check an existing booking</Link>
                  <p className="text-sm text-muted-foreground">Use your retrieval code to return to the response.</p>
                </div>
              </div>
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">This office does not take online bookings. Contact them directly or walk in.</p>
          )}

          {/* The card above already shows the address, the hours and how to reach the office. This
              panel is only here to say so in words when none of them has been recorded. */}
          {!p.contact && !p.address && !p.hours && (
            <section className={PANEL} aria-labelledby="contact-heading">
              <h2 id="contact-heading" className="font-head text-2xl leading-heading text-primary">Contact directly</h2>
              <p className="mt-2 text-sm">No contact details have been recorded.</p>
            </section>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5" aria-label="Sources and a note">
          <section className={PANEL} aria-labelledby="provider-sources">
            <h2 id="provider-sources" className="font-head text-2xl leading-heading text-primary">Sources &amp; review</h2>
            <dl className="mt-3 flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Official source</dt>
                <dd className="mt-0.5">
                  {source
                    ? <a href={source} target="_blank" rel="noopener noreferrer" className={BUTTON_TEXT}>Open the official page{' '}<span className="sr-only">for {p.name} (opens in a new tab)</span></a>
                    : 'Not available'}
                </dd>
              </div>
              {checked && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Details last checked</dt>
                  <dd className="mt-0.5">{checked}</dd>
                </div>
              )}
            </dl>
          </section>
          <Callout title="Before making a request">
            Do not include names, identity numbers or unnecessary details about other people.
          </Callout>
        </aside>
      </div>
    </article>
  );
}

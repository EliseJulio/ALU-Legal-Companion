import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import CrisisAlert from '@/components/CrisisAlert';
import ErrorNotice from '@/components/ErrorNotice';
import Breadcrumb from '@/components/Breadcrumb';
import Icon from '@/components/Icon';
import { contactLink } from '@/lib/contactLinks';
import { BUTTON_ON_CHROME, BUTTON_OUTLINE, PAGE_TITLE, RING } from '@/lib/ui';

const NEAREST = [
  { label: 'Find a police station near me', query: 'police station' },
  { label: 'Find a health facility near me', query: 'hospital or health centre' },
];

const TOLL_FREE_NUMBERS = ['112', '3029', '116', '166', '1022'];
const isTollFree = (contact) => TOLL_FREE_NUMBERS.includes(contact.replace(/\D/g, ''));

// The value on the right of a contact. A number is large and red so it is found at a glance.
// Other values are words so they keep the text size.
// A link is the whole value area. It is at least 44 px high with a focus ring and a background step on hover.
// Only a text link underlines.
const VALUE_LINK = `inline-flex min-h-touch min-w-touch max-w-full items-center rounded-control px-2 hover:bg-chrome-raised focus-visible:ring-offset-surface ${RING}`;
const NUMBER_CLASS = 'font-head text-2xl leading-none tabular-nums tracking-[-0.01em] text-alert-text';
const WORDS_CLASS = 'text-base font-semibold text-info underline underline-offset-4';

function ContactValue({ contact }) {
  const link = contactLink(contact);
  if (link.kind === 'none') return null;
  if (link.kind === 'text') return <p className="font-mono text-base text-ink">{contact}</p>;
  if (link.kind === 'directory') {
    return <Link to={link.href} className={`${VALUE_LINK} ${WORDS_CLASS}`}>{contact}</Link>;
  }
  const isNumber = link.kind === 'tel';
  const external = link.kind === 'web';
  return (
    <a
      href={link.href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`${VALUE_LINK} ${isNumber ? NUMBER_CLASS : WORDS_CLASS}`}
    >
      {contact}
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}

export default function Emergency() {
  const { data: contacts, error, loading, refetch } = useApi('/emergency-contacts');
  // Set when the reader asks again. The button stays on the page and busy until the answer is in.
  // A button that left the page while it held focus would drop the reader at the top.
  const [tried, setTried] = useState(false);
  const contactsHeading = useRef(null);
  useEffect(() => {
    if (tried && !loading && !error) contactsHeading.current?.focus();
  }, [tried, loading, error]);

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Emergency numbers" />
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Emergency numbers</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">
        If you are in immediate danger, do not wait for an online answer or a consultation request.
      </p>
      {/* CrisisAlert is fixed text. 3029 and 112 are on the page even if the request fails. */}
      <div className="mt-6"><CrisisAlert /></div>

      <h2 className="mt-10 font-head text-[22px] leading-[1.25] tracking-[-0.02em] text-ink">If you cannot get online help</h2>
      <section aria-labelledby="in-person-heading" className="mt-4 rounded-card border border-chrome-raised bg-chrome p-7 text-chrome-foreground">
        <h3 id="in-person-heading" className="font-head text-[22px] leading-[1.25] tracking-[-0.02em]">Seek help in person if safe</h3>
        <p className="mt-3 max-w-reading">
          Move to a safer place if possible. Seek help in person at a nearby police station or health
          facility if you can do so safely.
        </p>
        <p className="mt-3 max-w-reading text-sm text-on-chrome">
          Ask a trusted person to help if it is safe. Do not wait for an online response.
        </p>
        {/* On campus the counsellor and the nurse are in the Directory. The Student Life page is
            only for more information. It opens in a new tab when pressed. */}
        <p className="mt-3 max-w-reading text-sm text-on-chrome">
          On the ALU campus, the wellness counsellor and the campus nurse are listed in the{' '}
          <Link to="/directory" className={`inline-flex min-h-touch items-center font-semibold text-chrome-foreground underline ${RING}`}>Directory</Link>.
        </p>
        <a
          href="https://studentlife.alueducation.com/wellness-diversity"
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-2 flex min-h-touch w-full items-center text-sm font-semibold text-chrome-foreground underline ${RING}`}
        >
          More about ALU student wellness<span className="sr-only"> (opens in a new tab)</span>
        </a>
        {/* A search for the nearest place, made by the reader. No address is stored or guessed.
            The links open Google Maps in a new tab only when pressed. */}
        <ul className="mt-5 flex flex-wrap gap-3">
          {NEAREST.map(({ label, query }) => (
            <li key={label}>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query}, Rwanda`)}`}
                target="_blank"
                rel="noreferrer"
                className={BUTTON_ON_CHROME}
              >
                <Icon name="location_on" className="text-base" />
                {label}{' '}<span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <h2 ref={contactsHeading} tabIndex={-1} className="mt-10 font-head text-[22px] leading-[1.25] tracking-[-0.02em] text-ink outline-none">Contacts</h2>
      {loading && <p role="status" className="mt-4 text-muted-foreground">Loading contacts…</p>}
      {error && <ErrorNotice error={error} className="mt-4" />}
      {/* The numbers above are always on the page. This only asks again for the longer list. */}
      {(error || (loading && tried)) && (
        <button
          type="button"
          aria-disabled={loading || undefined}
          aria-busy={loading}
          onClick={() => { setTried(true); refetch(); }}
          className={`${BUTTON_OUTLINE} mt-3`}
        >
          Try loading contacts again
        </button>
      )}

      {/* One card of rows. The numbers are the only red text on the app: the
          emergency colour is kept for the numbers a person has to dial. */}
      <ul className="mt-4 rounded-card border border-border bg-surface px-[22px]">
        {contacts?.map((c) => (
          <li key={c.name} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border-soft py-6 first:border-t-0">
            <div className="min-w-0">
              <h3 className="font-head text-[15px] leading-[1.3] text-ink">{c.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.when}</p>
              {isTollFree(c.contact) && (
                <p className="mt-1 text-xs text-faint">
                  Toll-free / Ubuntu (No airtime needed on MTN &amp; Airtel Rwanda)
                </p>
              )}
            </div>
            {/* Full width on a phone, so the number sits under its description. Right on a desktop. */}
            <div className="flex w-full justify-start sm:w-auto sm:justify-end">
              <ContactValue contact={c.contact} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

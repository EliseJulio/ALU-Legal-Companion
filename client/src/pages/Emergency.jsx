import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import CrisisAlert from '@/components/CrisisAlert';
import ErrorNotice from '@/components/ErrorNotice';
import Breadcrumb from '@/components/Breadcrumb';
import Icon from '@/components/Icon';
import { BUTTON_ON_CHROME, BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/lib/ui';

const NEAREST = [
  { label: 'Find a police station near me', query: 'police station' },
  { label: 'Find a health facility near me', query: 'hospital or health centre' },
];

// The contact list has phone numbers such as 112 and 3029. It also has a website and a line of
// text such as "Nearest district office". Only a value that a phone can dial becomes a link.
const isDialable = (contact) => /^[0-9 +]+$/.test(contact.trim());

const TOLL_FREE_NUMBERS = ['112', '3029', '116', '166', '1022'];
const isTollFree = (contact) => TOLL_FREE_NUMBERS.includes(contact.replace(/\D/g, ''));

export default function Emergency() {
  const { data: contacts, error, loading, refetch } = useApi('/emergency-contacts');
  // Set when the reader asks again. The button then stays on the page, busy, until the answer is
  // in. A button that left the page while it held focus would drop the reader at the top.
  const [tried, setTried] = useState(false);
  const contactsHeading = useRef(null);
  useEffect(() => {
    if (tried && !loading && !error) contactsHeading.current?.focus();
  }, [tried, loading, error]);

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Emergency numbers" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Emergency numbers</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">
        If you are in immediate danger, do not wait for an online answer or a consultation request.
      </p>
      {/* CrisisAlert is fixed text. 3029 and 112 are on the page even if the request fails. */}
      <div className="mt-6"><CrisisAlert /></div>

      <h2 className="mt-10 font-head text-3xl leading-heading text-primary">If you cannot get online help</h2>
      <section aria-labelledby="in-person-heading" className="mt-4 rounded-card border border-chrome-raised bg-chrome p-7 text-chrome-foreground">
        <h3 id="in-person-heading" className="font-head text-3xl leading-heading">Seek help in person if safe</h3>
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
          <Link to="/directory" className="font-semibold text-chrome-foreground underline">Directory</Link>.{' '}
          <a href="https://studentlife.alueducation.com/wellness-diversity" target="_blank" rel="noopener noreferrer" className="font-semibold text-chrome-foreground underline">
            More about ALU student wellness<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
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

      <h2 ref={contactsHeading} tabIndex={-1} className="mt-10 font-head text-3xl leading-heading text-primary outline-none">Contacts</h2>
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

      <ul className="mt-4 grid gap-5 md:grid-cols-2">
        {contacts?.map((c) => (
          <li key={c.name} className="rounded-card border border-border bg-surface p-6">
            <h3 className="font-head text-2xl leading-heading text-primary">{c.name}</h3>
            {isDialable(c.contact) ? (
              <a href={`tel:${c.contact.replace(/\s+/g, '')}`} className={`mt-3 font-mono ${BUTTON_PRIMARY}`}>
                {c.contact}
              </a>
            ) : (
              <p className="mt-3 font-mono text-primary">{c.contact}</p>
            )}
            {isTollFree(c.contact) && (
              <p className="mt-2 text-xs font-semibold text-secondary">
                Toll-free / Ubuntu (No airtime needed on MTN &amp; Airtel Rwanda)
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">{c.when}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

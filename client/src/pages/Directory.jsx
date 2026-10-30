import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import ProviderCard from '@/components/ProviderCard';
import ProviderTable from '@/components/ProviderTable';
import { useMediaQuery } from '@/lib/useMediaQuery';
import ErrorNotice from '@/components/ErrorNotice';
import Icon from '@/components/Icon';
import { CATEGORIES } from '@/lib/directory';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_TEXT, RING_ON_CANVAS } from '@/lib/ui';

// The directory of lawyers, consultants and organisations. Every entry shown was checked and
// published by an admin. The category is in the address (?category=lawyer) so a link can open it
// already filtered. The server returns bookable entries first. The page keeps that order.
// The search sends the words to the server, which matches name, place and services.
export default function Directory() {
  const [params] = useSearchParams();
  // A category that is not one of the three is ignored. The page then shows everything.
  const category = CATEGORIES.some((c) => c.value === params.get('category')) ? params.get('category') : '';
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  const filters = new URLSearchParams();
  if (category) filters.set('category', category);
  if (query) filters.set('q', query);
  const path = `/directory/providers${filters.toString() ? `?${filters}` : ''}`;
  const { data: providers, error, loading } = useApi(path);
  // A wide screen compares the providers in a table. A narrow one reads them as cards, as on a phone.
  const wide = useMediaQuery('(min-width: 1280px)');

  const tabs = [{ value: '', label: 'All' }, ...CATEGORIES];

  let announcement = '';
  if (!loading && providers) {
    announcement = providers.length === 0 ? 'No providers found'
      : providers.length === 1 ? '1 provider listed' : `${providers.length} providers listed`;
  }

  function search(event) {
    event.preventDefault();
    setQuery(text.trim());
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" className={`underline ${RING_ON_CANVAS}`}>Home</Link> / <span aria-current="page">Directory</span>
      </nav>

      <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_26.25rem] xl:gap-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Directory</p>
          <h1 className="mt-3 font-head text-4xl leading-heading text-primary md:text-5xl">Find appropriate assistance.</h1>
          <p className="mt-5 max-w-reading text-muted-foreground">
            Pro-bono lawyers, free consultants and the organisations that handle legal problems in
            Rwanda. Entries marked as bookable can be asked for a time here with no account and no name.
          </p>

          <nav aria-label="Category" className="mt-6">
            <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {tabs.map(({ value, label }) => (
                <li key={label}>
                  <Link
                    to={value ? `/directory?category=${value}` : '/directory'}
                    aria-current={value === category ? 'page' : undefined}
                    className={`${value === category ? BUTTON_PRIMARY : BUTTON_OUTLINE} w-full sm:w-auto`}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <aside aria-labelledby="connect-heading" className="self-start rounded-card border border-border bg-surface p-6">
          <h2 id="connect-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Choose how to connect</h2>
          <p className="mt-3 text-primary">
            A booking request is not a confirmed appointment. The provider must accept it first.
          </p>
          <p className="mt-3 text-sm">
            Other offices are contact-direct listings. Check the details before contacting or visiting.
          </p>
          <Link to="/directory/booking-check" className={`mt-3 ${BUTTON_TEXT}`}>
            Already requested a booking? Check with your code →
          </Link>
        </aside>
      </div>

      <form onSubmit={search} role="search" className="mt-8">
        <label htmlFor="provider-search" className="block text-sm font-semibold">Search providers</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="flex min-h-[3.25rem] flex-1 items-center gap-3 rounded border border-input bg-surface px-4 focus-within:ring-2 focus-within:ring-focus">
            <Icon name="search" className="text-xl text-muted-foreground" />
            <input
              id="provider-search"
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="A name, a place or what they help with"
              className="min-h-touch w-full min-w-0 bg-transparent py-2 focus:outline-none"
            />
          </div>
          <button type="submit" className={BUTTON_PRIMARY}>Search</button>
        </div>
        {query && (
          <button type="button" onClick={() => { setText(''); setQuery(''); }} className={`mt-2 ${BUTTON_TEXT}`}>
            Clear the search
          </button>
        )}
      </form>

      <section aria-labelledby="compare-heading" className="mt-10">
        <h2 id="compare-heading" className="font-head text-3xl leading-heading text-primary">Compare providers</h2>
        <p className="mt-2 text-sm text-muted-foreground">Compare services, languages, location and cost.</p>
        {/* One region for the page. It stays in the page and only its words change, so a screen reader
            hears every result, including "No providers found". */}
        <p role="status" className="sr-only">{announcement}</p>

        {loading && <p className="mt-6 text-muted-foreground">Finding legal help…</p>}
        {error && <ErrorNotice error={error} className="mt-6" />}

        {!loading && providers?.length === 0 && (
          <p className="mt-6 font-medium">{query ? 'Nobody listed matches that search.' : 'Nobody is listed here yet.'}</p>
        )}

        {/* This page must never end with nobody to turn to. If the list is empty or failed, the
            reader is shown two other ways forward. */}
        {!loading && !providers?.length && (
          <div className="mt-3 rounded-card border border-border bg-surface p-6">
            <h3 className="font-head text-2xl text-primary">You can still get help</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              A legal expert can answer in writing without knowing who you are. The emergency
              numbers work whether or not this page loads.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link to="/ask" className={BUTTON_PRIMARY}>Ask a legal expert</Link>
              <Link to="/emergency" className={BUTTON_OUTLINE}>If you are in danger right now</Link>
            </div>
          </div>
        )}

        {providers?.length > 0 && (wide ? (
          <ProviderTable providers={providers} />
        ) : (
          <ul className="mt-6 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-1">
            {providers.map((p) => <ProviderCard key={p.id} provider={p} />)}
          </ul>
        ))}
      </section>
    </div>
  );
}

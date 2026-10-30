import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import Icon from '@/components/Icon';
import Breadcrumb from '@/components/Breadcrumb';
import RwandaJurisdictionLadder from '@/components/RwandaJurisdictionLadder';
import { DOMAINS, readableDays, typeLabel } from '@/lib/directory';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_TEXT } from '@/lib/ui';

// Where a matter must be taken first. Every answer comes from a route that an admin
// checked and published. The search only matches the reader's words against the wording of each matter.
// No model is asked. The office, the law and the deadline shown are facts somebody checked.
export default function WhereToGo() {
  // A link can open the page on one area: /where-to-go?area=tenancy. An area the platform does
  // not know is ignored.
  const [params, setParams] = useSearchParams();
  const fromAddress = params.get('area');
  // The address is the one place the area lives. So a link to /where-to-go resets the chips too.
  const area = DOMAINS.some((d) => d.value === fromAddress) ? fromAddress : '';
  const areaLabel = DOMAINS.find((d) => d.value === area)?.label;
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  // Joined by hand so a space stays %20 and the address reads the same everywhere.
  const parts = [];
  if (query) parts.push(`q=${encodeURIComponent(query)}`);
  if (area) parts.push(`area=${area}`);
  const path = `/directory/routes${parts.length ? `?${parts.join('&')}` : ''}`;
  const { data: routes, error, loading } = useApi(path);
  const narrowed = Boolean(query || area);

  function search(event) {
    event.preventDefault();
    setQuery(text.trim());
  }

  function chooseArea(value) {
    setParams((old) => {
      const next = new URLSearchParams(old);
      if (value) next.set('area', value);
      else next.delete('area');
      return next;
    }, { replace: true });
  }

  function showEvery() {
    setText('');
    setQuery('');
    chooseArea('');
  }

  // One announcement for the whole page. The region stays in the page so a screen reader
  // hears each change, including the answer "nothing found".
  const announcement = loading || !routes
    ? ''
    : routes.length === 0 ? 'No matters found' : routes.length === 1 ? '1 matter found' : `${routes.length} matters found`;

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Where to Go" />

      <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_18.75rem] xl:gap-10">
        <div className="min-w-0">
          <h1 className="font-head text-4xl leading-heading text-primary md:text-5xl">Where could I go next?</h1>
          <p className="mt-5 max-w-reading text-muted-foreground">
            Many matters in Rwanda must go to one particular office first. If you go somewhere
            else you can be turned away or run out of time. Say what happened to see where to
            start, the law behind it, the steps and any deadline.
          </p>
          <p className="mt-3 max-w-reading text-sm text-muted-foreground">
            A match is a starting point, not a guaranteed destination.
          </p>

          <form onSubmit={search} className="mt-8" role="search">
            <label htmlFor="where-search" className="block text-sm font-semibold">Describe your issue</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <div className="flex min-h-[3.25rem] flex-1 items-center gap-3 rounded border border-input bg-surface px-4 focus-within:ring-2 focus-within:ring-focus">
                <Icon name="search" className="text-xl text-muted-foreground" />
                <input
                  id="where-search"
                  type="search"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. my landlord kept my deposit"
                  className="min-h-touch w-full min-w-0 bg-transparent py-2 focus:outline-none"
                />
              </div>
              <button type="submit" className={BUTTON_PRIMARY}>Search</button>
            </div>
            {narrowed && (
              <button type="button" onClick={showEvery} className={`mt-2 ${BUTTON_TEXT}`}>
                Show every matter
              </button>
            )}
          </form>

          {/* The areas are checked facts of each matter. The search words and the area work together. */}
          <p id="where-filter" className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter by issue</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-labelledby="where-filter">
            {[{ value: '', label: 'All' }, ...DOMAINS].map(({ value, label }) => (
              <button
                key={label}
                type="button"
                aria-pressed={area === value}
                // Pressing the chosen issue again clears it, as the cross on the chip says.
                onClick={() => chooseArea(value && area === value ? '' : value)}
                className={`${area === value ? BUTTON_PRIMARY : BUTTON_OUTLINE} w-full sm:w-auto`}
              >
                {label}
                {value && area === value && <span aria-hidden="true">&nbsp;×</span>}
              </button>
            ))}
          </div>

          <p role="status" className="sr-only">{announcement}</p>
          {loading && <p className="mt-8 text-muted-foreground">Looking up where to go…</p>}
          {error && <ErrorNotice error={error} className="mt-8" />}

          {routes && routes.length === 0 && (
            <div className="mt-8 rounded-card border border-border bg-surface p-6">
              <h2 className="font-head text-2xl text-primary">
                {narrowed ? 'Nothing in the directory matches that yet' : 'No matters have been checked yet'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The free legal aid office in your district can tell you where to start with any matter.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link to="/directory" className={BUTTON_OUTLINE}>See the directory</Link>
                <Link to="/ask" className={BUTTON_OUTLINE}>Ask a legal expert</Link>
              </div>
            </div>
          )}

          {routes?.length > 0 && (
            <section className="mt-8" aria-labelledby="where-results">
              <h2 id="where-results" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {query
                  ? `Matches for “${query}”${areaLabel ? ` in ${areaLabel}` : ''}`
                  : areaLabel ? `Checked matters in ${areaLabel}` : 'Every matter that has been checked'}
              </h2>
              <ul className="mt-4 space-y-5">
                {routes.map((r) => {
                  const days = readableDays(r.deadline_days);
                  const cardArea = DOMAINS.find((d) => d.value === r.area)?.label;
                  return (
                    <li key={r.id} className="flex flex-col gap-3 border border-t-2 border-border bg-surface p-6">
                      {cardArea && (
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cardArea}</p>
                      )}
                      <h3 className="font-head text-2xl leading-heading text-primary md:text-[1.75rem]">{r.title}</h3>
                      <p className="font-semibold">Go first to: {r.first_forum_name}</p>
                      {r.first_forum_type && (
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{typeLabel(r.first_forum_type)}</p>
                      )}
                      {days ? (
                        <p className="text-sm font-semibold text-warning-strong">
                          Time limit: {days} from {r.deadline_runs_from}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No deadline has been recorded for this matter.</p>
                      )}
                      <div>
                        <Link to={`/where-to-go/${r.id}`} className={BUTTON_PRIMARY}>
                          Read route and next steps{" "}<span className="sr-only">for {r.title}</span>
                          <span aria-hidden="true">&nbsp;→</span>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside aria-labelledby="where-help" className="flex flex-col gap-5 xl:self-start xl:rounded-card xl:border xl:border-border xl:bg-surface xl:p-6">
          <h2 id="where-help" className="font-head text-3xl leading-heading text-primary">Search in your own words</h2>
          <p className="text-sm">
            Try words about what happened, such as “deposit”, “dismissed” or “permit”. Search
            matches the wording of the matters that have been checked. It does not decide your legal position.
          </p>
          <div className="border-l-4 border-info bg-primary-subtle p-4 text-sm">
            <p className="font-semibold text-primary">Can’t find a close match?</p>
            <p className="mt-1">Try fewer words or ask a human legal expert. Don’t choose a route that does not fit.</p>
          </div>
          <Link to="/ask" className={BUTTON_TEXT}>Ask a legal expert<span aria-hidden="true">&nbsp;→</span></Link>
          <Link to="/directory" className={BUTTON_TEXT}>Browse the Directory<span aria-hidden="true">&nbsp;→</span></Link>
          <RwandaJurisdictionLadder className="mt-2" />
        </aside>
      </div>
    </div>
  );
}

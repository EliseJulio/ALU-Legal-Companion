import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useMediaQuery } from '@/lib/useMediaQuery';
import GuideCard from '@/components/GuideCard';
import ErrorNotice from '@/components/ErrorNotice';
import Breadcrumb from '@/components/Breadcrumb';
import Icon from '@/components/Icon';
import { CheckField } from '@/components/Field';
import { DOMAINS } from '@/lib/directory';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_TEXT } from '@/lib/ui';

const NEXT_STEP = 'rounded-card border border-border bg-surface p-6';
const ORDER = DOMAINS.map((d) => d.value);
const labelOf = (value) => DOMAINS.find((d) => d.value === value)?.label ?? value;

// The topics chosen, read from the address: ?domain=tenancy,employment. A topic the platform does
// not know is dropped and a repeat counts once. They are always in the order of the buttons.
function chosenFrom(raw) {
  const asked = new Set((raw ?? '').split(','));
  return ORDER.filter((value) => asked.has(value));
}

// Guides in simple words that an admin has checked against the law. The server sends
// published guides only. The topics are filtered here, from that one list, so more than one topic
// can be chosen at a time.
export default function GuideLibrary() {
  const [search, setSearch] = useState('');
  const [params, setParams] = useSearchParams();
  const chosen = chosenFrom(params.get('domain'));
  // A wide screen has a row of topic buttons. A narrow one has the Filter guides panel of the design.
  const wide = useMediaQuery('(min-width: 768px)');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const trigger = useRef(null);
  const wasOpen = useRef(false);
  // The panel exists only on a narrow screen. If the window grows wide with it open, it is closed
  // here so it does not wait, open and out of date, for the window to narrow again.
  if (wide && open) setOpen(false);

  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  const text = query.toString();
  const { data: guides, error, loading } = useApi(`/guides${text ? `?${text}` : ''}`);
  const shown = guides ? (chosen.length ? guides.filter((g) => chosen.includes(g.domain)) : guides) : null;

  // The address holds the choice, so it survives a reload, a shared link and the Back button.
  function choose(next) {
    setParams((old) => {
      const updated = new URLSearchParams(old);
      if (next.length) updated.set('domain', ORDER.filter((value) => next.includes(value)).join(','));
      else updated.delete('domain');
      return updated;
    }, { replace: true });
  }
  const toggle = (value) => choose(chosen.includes(value) ? chosen.filter((c) => c !== value) : [...chosen, value]);

  function openPanel() {
    setDraft(chosen);
    setOpen(true);
  }
  const closePanel = () => setOpen(false);
  function apply() {
    choose(draft);
    setOpen(false);
  }
  function clear() {
    choose([]);
    setOpen(false);
  }

  // Opening moves focus into the panel. Closing, by any way, puts it back on the button that opened it.
  useEffect(() => {
    if (open) document.getElementById(`filter-topic-${ORDER[0]}`)?.focus();
    else if (wasOpen.current) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);
  // Escape closes the panel.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // One announcement for the page. It stays in the page and only its words change.
  // It names the filters, so the words change whenever the filters do, even if the count stays.
  let announcement = '';
  if (shown) {
    announcement = shown.length === 0 ? 'No guides found'
      : shown.length === 1 ? '1 guide listed' : `${shown.length} guides listed`;
    if (chosen.length) announcement += `, filtered by ${chosen.map(labelOf).join(', ')}`;
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Legal Guides" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Understand before you act.</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">
        Explore everyday legal topics in simple words and find a possible next step. Each guide
        is checked against the law before it is published.
      </p>

      <label htmlFor="guide-search" className="mt-8 block text-sm font-semibold">Search guides</label>
      <div className="mt-2 flex min-h-[3.25rem] max-w-form items-center gap-3 rounded border border-input bg-surface px-4 focus-within:ring-2 focus-within:ring-focus">
        <Icon name="search" className="text-xl text-muted-foreground" />
        <input
          id="guide-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="deposits, contracts, permits…"
          className="min-h-touch w-full min-w-0 bg-transparent py-2 focus:outline-none"
        />
      </div>

      {wide ? (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by topic">
          <button
            type="button"
            aria-pressed={chosen.length === 0}
            onClick={() => choose([])}
            className={chosen.length === 0 ? BUTTON_PRIMARY : BUTTON_OUTLINE}
          >
            All
          </button>
          {DOMAINS.map(({ value, label }) => {
            const on = chosen.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(value)}
                className={on ? BUTTON_PRIMARY : BUTTON_OUTLINE}
              >
                {label}
                {on && <span aria-hidden="true">&nbsp;×</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <button
            ref={trigger}
            type="button"
            aria-expanded={open}
            aria-controls={open ? 'filter-panel' : undefined}
            onClick={open ? closePanel : openPanel}
            className={`${BUTTON_OUTLINE} w-full`}
          >
            Filter guides{chosen.length ? ` (${chosen.length})` : ''}
          </button>

          {/* The filters that are on stay in view when the panel is closed, each one removable. */}
          {chosen.length > 0 && !open && (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Applied filters">
              {chosen.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Remove filter: ${labelOf(value)}`}
                  // The chip leaves the page when it is pressed. Focus goes to the button above it.
                  onClick={() => { toggle(value); trigger.current?.focus(); }}
                  className={BUTTON_PRIMARY}
                >
                  {labelOf(value)}
                  <span aria-hidden="true">&nbsp;×</span>
                </button>
              ))}
            </div>
          )}

          {open && (
            <section id="filter-panel" aria-labelledby="filter-heading" className={`mt-3 ${NEXT_STEP}`}>
              <h2 id="filter-heading" className="font-head text-2xl leading-heading text-primary">Filter guides</h2>
              <button type="button" onClick={closePanel} className={`${BUTTON_OUTLINE} mt-3`}>
                Close filters<span aria-hidden="true">&nbsp;×</span>
              </button>
              <fieldset className="mt-3">
                <legend className="sr-only">Topics</legend>
                {DOMAINS.map(({ value, label }) => (
                  <CheckField
                    key={value}
                    id={`filter-topic-${value}`}
                    label={label}
                    checked={draft.includes(value)}
                    onChange={(on) => setDraft((old) => (on ? [...old, value] : old.filter((v) => v !== value)))}
                  />
                ))}
              </fieldset>
              <div className="mt-4 flex flex-col gap-3">
                <button type="button" onClick={apply} className={`${BUTTON_PRIMARY} w-full`}>Apply filters</button>
                <button type="button" onClick={clear} className={`${BUTTON_OUTLINE} w-full`}>Clear filters</button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">The filters you choose stay in view after the panel closes.</p>
            </section>
          )}
        </div>
      )}

      <p role="status" className="sr-only">{announcement}</p>
      {loading && <p className="mt-6 text-muted-foreground">Loading guides…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      {shown?.length === 0 && (
        <div className={`mt-6 ${NEXT_STEP}`}>
          <p className="font-medium">No guides match that yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The library is still growing. A legal expert can answer directly. You can ask without giving your name.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {chosen.length > 0 && (
              <button
                type="button"
                // This button leaves the page when it is pressed. Focus goes to the search box.
                onClick={() => { choose([]); document.getElementById('guide-search')?.focus(); }}
                className={BUTTON_OUTLINE}
              >
                Show every guide
              </button>
            )}
            <Link to="/ask" className={BUTTON_PRIMARY}>Ask a legal expert</Link>
          </div>
        </div>
      )}

      {shown?.length > 0 && (
        <ul className="mt-6 grid gap-5 md:grid-cols-2">
          {shown.map((g) => <GuideCard key={g.id} guide={g} />)}
        </ul>
      )}

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <section className={NEXT_STEP} aria-labelledby="begin-heading">
          <h2 id="begin-heading" className="font-head text-2xl text-primary">Not sure where to begin?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Browse possible destinations for your situation.</p>
          <Link to="/where-to-go" className={`mt-2 ${BUTTON_TEXT}`}>Explore Where to Go</Link>
        </section>
        <section className={NEXT_STEP} aria-labelledby="person-heading">
          <h2 id="person-heading" className="font-head text-2xl text-primary">Ask a person</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Send a written question to a human legal expert. A response is not guaranteed.
          </p>
          <Link to="/ask" className={`mt-2 ${BUTTON_TEXT}`}>Ask a legal expert</Link>
        </section>
      </div>
    </div>
  );
}

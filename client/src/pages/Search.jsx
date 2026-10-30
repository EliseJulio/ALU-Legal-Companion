import { useEffect, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import Breadcrumb from '@/components/Breadcrumb';
import ErrorNotice from '@/components/ErrorNotice';
import Icon from '@/components/Icon';
import { DOMAINS, typeLabel } from '@/lib/directory';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, FIELD, PANEL } from '@/lib/ui';

// One search over the guides, the matters and the directory. The server returns only what an admin
// has published, so nothing here can be unchecked. The words and the library are in the
// address, so a result page can be shared, reloaded and reached with the back button.
const MIN = 2;
const LIBRARIES = [
  { value: 'all', label: 'All libraries' },
  { value: 'guides', label: 'Legal guides' },
  { value: 'routes', label: 'Where to Go matters' },
  { value: 'providers', label: 'Directory' },
];
const SECTIONS = {
  guides: { heading: 'Legal guides', none: 'No guide matches these words.' },
  routes: { heading: 'Where to Go matters', none: 'No matter matches these words.' },
  providers: { heading: 'Directory', none: 'Nothing in the directory matches these words.' },
};
const ITEM = 'rounded-card border border-border bg-surface p-5';
const TITLE_LINK = 'inline-block py-1 font-head text-xl leading-heading text-primary underline hover:no-underline';

const subjectOf = (domain) => DOMAINS.find((d) => d.value === domain)?.label;

function Guide({ guide }) {
  const subject = subjectOf(guide.domain);
  return (
    <li className={ITEM}>
      {subject && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{subject}</p>}
      <Link to={`/guides/${guide.id}`} className={TITLE_LINK}>{guide.title}</Link>
      {guide.summary && <p className="mt-1 text-sm text-muted-foreground">{guide.summary}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{guide.source_law}</p>
    </li>
  );
}

function Route({ route }) {
  return (
    <li className={ITEM}>
      <Link to={`/where-to-go/${route.id}`} className={TITLE_LINK}>{route.title}</Link>
      <p className="mt-1 text-sm">Go first to: <span className="font-semibold">{route.first_forum_name}</span></p>
    </li>
  );
}

function Provider({ provider }) {
  const place = [typeLabel(provider.type), provider.location].filter(Boolean).join(' · ');
  return (
    <li className={ITEM}>
      <Link to={`/directory/${provider.id}`} className={TITLE_LINK}>{provider.name}</Link>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{place}</p>
      {provider.services && <p className="mt-1 text-sm">{provider.services}</p>}
    </li>
  );
}

const ITEMS = { guides: Guide, routes: Route, providers: Provider };
const PROP = { guides: 'guide', routes: 'route', providers: 'provider' };

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const fromAddress = params.get('library');
  const library = LIBRARIES.some((l) => l.value === fromAddress) ? fromAddress : 'all';
  const ready = q.length >= MIN;
  const { data, error, loading } = useApi(ready ? `/search?q=${encodeURIComponent(q)}&library=${library}` : '');
  const location = useLocation();
  const heading = useRef(null);
  const wordsBox = useRef(null);
  const libraryBox = useRef(null);

  // The boxes are not remounted by a search, so a person who pressed Enter keeps their place. When
  // the address changes by another way (the Back button, a link) the boxes are set from it.
  useEffect(() => {
    if (wordsBox.current && wordsBox.current.value.trim() !== q) wordsBox.current.value = q;
    if (libraryBox.current) libraryBox.current.value = library;
  }, [q, library]);

  // A search from the menu leaves the person in the menu. The page heading takes focus so the new
  // page is read from its top and the results are not left behind the menu.
  const focusResults = Boolean(location.state?.focusResults);
  useEffect(() => {
    if (focusResults) heading.current?.focus();
  }, [location.key, focusResults]);

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const words = String(form.get('q') ?? '').trim();
    const chosen = String(form.get('library'));
    // The address holds only what was chosen. All libraries is the default and is left out.
    const next = new URLSearchParams();
    if (words) next.set('q', words);
    if (chosen !== 'all') next.set('library', chosen);
    // The same search again does not add a step to the Back button.
    setParams(next, { replace: next.toString() === params.toString() });
  }

  const results = data?.results ?? null;
  const sections = results ? Object.keys(SECTIONS).filter((key) => key in results) : [];
  const total = sections.reduce((sum, key) => sum + results[key].length, 0);
  // One announcement for the page. It stays in the page so a screen reader hears every change.
  // The short-words notice and the wait are in it as well as the count.
  let announcement = '';
  if (q && !ready) announcement = `Type at least ${MIN} characters to search.`;
  else if (ready && loading) announcement = 'Searching';
  else if (results) {
    announcement = total === 0 ? `No results found for “${q}”`
      : `${total} ${total === 1 ? 'result' : 'results'} found for “${q}”`;
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Search" />
      <h1 ref={heading} tabIndex={-1} className="mt-6 font-head text-4xl leading-heading text-primary outline-none md:text-5xl">Search</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">
        Search the guides, the matters and the directory. Only items an admin has checked and published are listed.
      </p>

      <form onSubmit={submit} role="search" aria-label="Search results" className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
        <div>
          <label htmlFor="search-words" className="block text-sm font-semibold">Search guides, routes and providers</label>
          <div className="mt-2 flex min-h-[3.25rem] items-center gap-3 rounded border border-input bg-surface px-4 focus-within:ring-2 focus-within:ring-focus">
            <Icon name="search" className="text-xl text-muted-foreground" />
            <input
              id="search-words"
              ref={wordsBox}
              name="q"
              type="search"
              defaultValue={q}
              maxLength={100}
              placeholder="e.g. deposit"
              className="min-h-touch w-full min-w-0 bg-transparent py-2 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label htmlFor="search-library" className="block text-sm font-semibold">Where to search</label>
          <select id="search-library" ref={libraryBox} name="library" defaultValue={library} className={`${FIELD} mt-2`}>
            {LIBRARIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <button type="submit" className={BUTTON_PRIMARY}>Search</button>
      </form>

      <p role="status" className="sr-only">{announcement}</p>

      {!q && <p className="mt-8 text-muted-foreground">Type a word or two about what happened, such as “deposit” or “permit”.</p>}
      {q && !ready && <p className="mt-8 text-muted-foreground">Type at least {MIN} characters to search.</p>}
      {ready && loading && <p className="mt-8 text-muted-foreground">Searching…</p>}
      {error && <ErrorNotice error={error} className="mt-8" />}

      {results && total === 0 && (
        <div className={`mt-8 ${PANEL}`}>
          <h2 className="font-head text-2xl leading-heading text-primary">Nothing matches “{q}”</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try fewer or simpler words. The free legal aid office in your district can tell you where to start.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link to="/where-to-go" className={BUTTON_OUTLINE}>Find where to go</Link>
            <Link to="/ask" className={BUTTON_OUTLINE}>Ask a legal expert</Link>
          </div>
        </div>
      )}

      {results && total > 0 && sections.map((key) => {
        const Item = ITEMS[key];
        const list = results[key];
        return (
          <section key={key} aria-labelledby={`search-${key}`} className="mt-10">
            <h2 id={`search-${key}`} className="font-head text-2xl leading-heading text-primary">{SECTIONS[key].heading}</h2>
            {list.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{SECTIONS[key].none}</p>
            ) : (
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {list.map((row) => <Item key={row.id} {...{ [PROP[key]]: row }} />)}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

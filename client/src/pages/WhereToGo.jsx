import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import { readableDays } from '@/lib/directory';
import { RING, RING_ON_CANVAS } from '@/lib/ui';

const FIELD = 'mt-1 w-full min-h-touch rounded border border-input bg-surface p-2 focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-inset';

// Where a matter must be taken first. Every answer comes from a route that a legal expert
// verified. The search only matches the reader's words against the wording of each matter.
// No model is asked. The office, the law and the deadline shown are facts somebody checked.
export default function WhereToGo() {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const path = query ? `/directory/routes?q=${encodeURIComponent(query)}` : '/directory/routes';
  const { data: routes, error, loading } = useApi(path);

  function search(event) {
    event.preventDefault();
    setQuery(text.trim());
  }

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Where do I take this?</h1>
      <p className="mt-1 text-muted-foreground">
        Many matters in Rwanda must go to one particular office first. If you go somewhere else
        you can be turned away or run out of time. Say what happened to see where to start, the
        law behind it, the steps and any deadline.
      </p>

      <form onSubmit={search} className="mt-4" role="search">
        <label htmlFor="where-search" className="block text-sm font-medium">Describe what happened in your own words</label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id="where-search"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. my landlord kept my deposit"
            className={FIELD}
          />
          <button type="submit" className={`min-h-touch rounded bg-primary px-4 font-head text-sm font-semibold text-primary-foreground ${RING_ON_CANVAS}`}>
            Find where to go
          </button>
        </div>
        {query && (
          <button type="button" onClick={() => { setText(''); setQuery(''); }} className={`mt-2 min-h-touch text-sm font-semibold text-primary underline ${RING_ON_CANVAS}`}>
            Show every matter
          </button>
        )}
      </form>

      {loading && <p className="mt-6 text-muted-foreground">Looking up where to go…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      {routes && routes.length === 0 && (
        <div className="mt-6 rounded border border-border bg-surface p-4">
          <h2 className="font-head text-base font-semibold text-primary">
            {query ? 'Nothing in the directory matches that yet' : 'No matters have been checked yet'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The free legal aid office in your district can tell you where to start with any matter.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link to="/directory" className={`min-h-touch rounded border border-primary 
              bg-surface px-4 py-2 text-center font-head text-sm font-semibold text-primary ${RING}`}>
              See the directory
            </Link>
            <Link to="/ask" className={`min-h-touch rounded border border-primary bg-surface 
              px-4 py-2 text-center font-head text-sm font-semibold text-primary ${RING}`}>
              Ask a legal expert
            </Link>
          </div>
        </div>
      )}

      {routes?.length > 0 && (
        <ul className="mt-6 space-y-3">
          {routes.map((r) => {
            const days = readableDays(r.deadline_days);
            return (
              <li key={r.id}>
                <Link
                  to={`/where-to-go/${r.id}`}
                  className={`block rounded border border-border bg-surface p-4 
                    hover:border-primary ${RING_ON_CANVAS}`}
                >
                  <span className="block font-head font-semibold text-primary">{r.title}</span>
                  <span className="mt-1 block text-sm">
                    Go first to: <span className="font-semibold">{r.first_forum_name}</span>
                  </span>
                  {days && (
                    <span className="mt-1 block text-sm font-semibold text-warning-strong">
                      Time limit: {days} from {r.deadline_runs_from}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

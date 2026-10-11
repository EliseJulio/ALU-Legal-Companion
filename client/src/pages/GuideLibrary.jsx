import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import GuideCard from '@/components/GuideCard';
import ErrorNotice from '@/components/ErrorNotice';
import { DOMAINS } from '@/lib/directory';
import { RING, BUTTON_PRIMARY } from '@/lib/ui';

// Plain-language guides that a legal expert has checked against the law. The server sends
// published guides only.
export default function GuideLibrary() {
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');

  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  if (domain) query.set('domain', domain);
  const text = query.toString();
  const { data: guides, error, loading } = useApi(`/guides${text ? `?${text}` : ''}`);

  const topics = [{ value: '', label: 'All' }, ...DOMAINS];

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Know where you stand</h1>
      <p className="mt-1 text-muted-foreground">Rwandan law in plain language, checked by a real lawyer.</p>

      <label htmlFor="guide-search" className="mt-4 block text-sm font-medium">Search guides</label>
      <input
        id="guide-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="deposits, contracts, permits…"
        className={`mt-1 w-full min-h-touch rounded border border-input 
          bg-surface px-3 ${RING} focus-visible:ring-offset-canvas`}
      />

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by topic">
        {topics.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            aria-pressed={domain === value}
            onClick={() => setDomain(value)}
            className={`min-h-touch min-w-touch rounded-full border px-3 text-sm 
              ${RING} focus-visible:ring-offset-canvas ${
              domain === value ? 'border-primary bg-primary font-bold text-primary-foreground' : 'border-input bg-surface'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-6 text-muted-foreground">Loading guides…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      {guides?.length === 0 && (
        <div className="mt-6 rounded border border-border bg-surface p-4">
          <p className="font-medium">No guides match that yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The library is still growing. A lawyer can answer directly. You can ask without giving your name.
          </p>
          <Link to="/ask" className={`${BUTTON_PRIMARY} mt-3`}>Ask a lawyer</Link>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {guides?.map((g) => <GuideCard key={g.id} guide={g} />)}
      </ul>
    </div>
  );
}

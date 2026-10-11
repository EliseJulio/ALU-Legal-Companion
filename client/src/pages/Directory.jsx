import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import ProviderCard from '@/components/ProviderCard';
import ErrorNotice from '@/components/ErrorNotice';
import { CATEGORIES } from '@/lib/directory';
import { RING, RING_ON_CANVAS } from '@/lib/ui';

// The directory of lawyers, consultants and organisations. Every entry shown was verified by a
// legal expert. The category is in the address (?category=lawyer) so a link can open it
// already filtered. The server returns bookable entries first. The page keeps that order.
export default function Directory() {
  const [params] = useSearchParams();
  // A category that is not one of the three is ignored. The page then shows everything.
  const category = CATEGORIES.some((c) => c.value === params.get('category')) ? params.get('category') : '';
  const path = category ? `/directory/providers?category=${category}` : '/directory/providers';
  const { data: providers, error, loading } = useApi(path);

  const tabs = [{ value: '', label: 'All' }, ...CATEGORIES];

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Find legal help</h1>
      <p className="mt-1 text-muted-foreground">
        Pro-bono lawyers, free consultants and the organisations that handle legal problems in
        Rwanda. Entries marked as bookable can be asked for a time here with no account and no name.
      </p>

      <nav aria-label="Category" className="mt-4">
        <ul className="flex flex-wrap gap-2">
          {tabs.map(({ value, label }) => (
            <li key={label}>
              <Link
                to={value ? `/directory?category=${value}` : '/directory'}
                aria-current={value === category ? 'page' : undefined}
                className={`inline-flex min-h-touch min-w-touch items-center justify-center 
                  rounded border px-4 text-sm font-semibold ${RING_ON_CANVAS} ${
                  value === category ? 'border-primary bg-primary text-primary-foreground' : 'border-primary bg-surface text-primary'
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="mt-3 text-sm">
        <Link to="/directory/booking-check" className={`inline-flex min-h-touch items-center 
          font-semibold text-primary underline ${RING_ON_CANVAS}`}>
          Already booked? Check it with your code
        </Link>
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Finding legal help…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      {!loading && providers?.length === 0 && (
        <p className="mt-6 font-medium">Nobody is listed here yet.</p>
      )}

      {/* This page must never end with nobody to turn to. If the list is empty or failed, the
          reader is shown two other ways forward. */}
      {!loading && !providers?.length && (
        <div className="mt-3 rounded border border-border bg-surface p-4">
          <h2 className="font-head text-base font-semibold text-primary">You can still get help</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A legal expert can answer in writing without knowing who you are. The emergency
            numbers work whether or not this page loads.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Link to="/ask" className={`min-h-touch rounded bg-primary px-4 py-2 
              text-center font-head text-sm font-semibold text-primary-foreground ${RING}`}>
              Ask a legal expert
            </Link>
            <Link to="/emergency" className={`min-h-touch rounded border border-primary 
              bg-surface px-4 py-2 text-center font-head text-sm font-semibold text-primary ${RING}`}>
              If you are in danger right now
            </Link>
          </div>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {providers?.map((p) => <ProviderCard key={p.id} provider={p} />)}
      </ul>
    </div>
  );
}

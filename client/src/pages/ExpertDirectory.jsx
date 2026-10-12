import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import ReviewActions from '@/components/ReviewActions';
import { typeLabel, readableDays } from '@/lib/directory';
import { readableDay } from '@/lib/dates';
import { PANEL } from '@/lib/ui';

const Row = ({ label, children }) => (
  children ? (<><dt className="text-muted-foreground">{label}</dt><dd>{children}</dd></>) : null
);

// The directory entries and the routes waiting for a legal expert. Every fact shown is one the
// expert is asked to check against the body's own source.
export default function ExpertDirectory() {
  const providers = useApi('/directory/providers/all');
  const routes = useApi('/directory/routes/all');
  const waitingProviders = providers.data?.filter((p) => p.status === 'pending_review');
  const waitingRoutes = routes.data?.filter((r) => r.status === 'pending_review');

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Directory review</h1>
      <p className="mt-1 text-muted-foreground">
        Lawyers, consultants, organisations and routes waiting for you. Check each fact against the
        body’s own source before you verify. A route only goes public when its first office is
        verified too.
      </p>

      <section aria-labelledby="entries-heading" className="mt-6">
        <h2 id="entries-heading" className="font-head text-lg font-semibold text-primary">Directory entries</h2>
        {providers.loading && <p className="mt-3 text-muted-foreground">Loading…</p>}
        {providers.error && <ErrorNotice error={providers.error} className="mt-3" />}
        {waitingProviders?.length === 0 && <p className={`mt-3 text-muted-foreground ${PANEL}`}>No entries are waiting.</p>}
        <ul className="mt-3 space-y-4">
          {waitingProviders?.map((p) => (
            <li key={p.id} className={PANEL}>
              <h3 className="font-head font-semibold text-primary">{p.name}</h3>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <Row label="Kind">{`${p.category} · ${typeLabel(p.type)}`}</Row>
                <Row label="Place">{p.location}</Row>
                <Row label="How to reach it">{p.contact}</Row>
                <Row label="What it does">{p.services}</Row>
                <Row label="Languages">{p.languages}</Row>
                <Row label="Cost">{p.is_free ? 'Free' : 'May charge a fee'}</Row>
                <Row label="Its own source">{p.official_source_url}</Row>
                <Row label="Last checked">{readableDay(p.last_checked_at)}</Row>
              </dl>
              {p.review_comment && <p className="mt-2 text-sm">Earlier comment: {p.review_comment}</p>}
              <ReviewActions path={`/directory/providers/${p.id}`} onDone={providers.refetch} className="mt-4" />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="routes-heading" className="mt-8">
        <h2 id="routes-heading" className="font-head text-lg font-semibold text-primary">Routes</h2>
        {routes.loading && <p className="mt-3 text-muted-foreground">Loading…</p>}
        {routes.error && <ErrorNotice error={routes.error} className="mt-3" />}
        {waitingRoutes?.length === 0 && <p className={`mt-3 text-muted-foreground ${PANEL}`}>No routes are waiting.</p>}
        <ul className="mt-3 space-y-4">
          {waitingRoutes?.map((r) => {
            const days = readableDays(r.deadline_days);
            return (
              <li key={r.id} className={PANEL}>
                <h3 className="font-head font-semibold text-primary">{r.title}</h3>
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <Row label="Goes first to">{r.first_forum_name}</Row>
                  <Row label="Why there">{r.legal_basis}</Row>
                  <Row label="Does not apply if">{r.exclusions}</Row>
                  <Row label="Deadline">{days ? `${days} from ${r.deadline_runs_from}` : null}</Row>
                </dl>
                <ol className="mt-2 list-decimal pl-6 text-sm">
                  {r.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
                {r.first_forum_status !== 'published' && (
                  <p className="mt-3 rounded border border-warning-border bg-warning-subtle p-3 text-sm font-semibold text-warning-strong">
                    Its first office is not verified yet. This route stays hidden from students
                    until that office is verified as well.
                  </p>
                )}
                {r.review_comment && <p className="mt-2 text-sm">Earlier comment: {r.review_comment}</p>}
                <ReviewActions path={`/directory/routes/${r.id}`} onDone={routes.refetch} className="mt-4" />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

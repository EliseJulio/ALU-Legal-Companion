import { Link, useParams } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import ErrorNotice from '@/components/ErrorNotice';
import VerifiedStamp from '@/components/VerifiedStamp';
import Disclaimer from '@/components/Disclaimer';
import ProviderCard from '@/components/ProviderCard';
import { readableDays } from '@/lib/directory';
import { RING, RING_ON_CANVAS } from '@/lib/ui';

// One matter. The office it goes to first, the law behind that, what happens next and the
// deadline. The server sends a route only when it and its office are both verified.
export default function MatterRoute() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: route, error, loading } = useApi(`/directory/routes/${id}`);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (error) {
    return (
      <div>
        <ErrorNotice error={error} />
        <p className="mt-4">
          <Link to="/where-to-go" className={`inline-flex min-h-touch items-center font-semibold 
            text-primary underline ${RING_ON_CANVAS}`}>
            Back to every matter
          </Link>
        </p>
      </div>
    );
  }

  const days = readableDays(route.deadline_days);

  return (
    <article>
      <p className="text-sm">
        <Link to="/where-to-go" className={`inline-flex min-h-touch items-center 
          font-semibold text-primary underline ${RING_ON_CANVAS}`}>
          ← Every matter
        </Link>
      </p>
      <h1 className="mt-1 font-head text-2xl text-primary">{route.title}</h1>
      <div className="mt-2"><VerifiedStamp name={route.verified_by_name} date={route.verified_at} /></div>

      <section className="mt-6" aria-labelledby="first-heading">
        <h2 id="first-heading" className="font-head text-lg font-semibold text-primary">Go here first</h2>
        <ul className="mt-2"><ProviderCard provider={route.first_forum} /></ul>
      </section>

      <section className="mt-6" aria-labelledby="why-heading">
        <h2 id="why-heading" className="font-head text-lg font-semibold text-primary">Why there</h2>
        <p className="mt-1">{route.legal_basis}</p>
        {route.exclusions && (
          <p className="mt-2 rounded border border-border bg-surface p-3 text-sm">
            <span className="font-semibold">This does not apply if: </span>{route.exclusions}
          </p>
        )}
      </section>

      {days && (
        // A deadline cannot be fixed later so it gets its own block. The word "deadline" is in
        // it. Colour never carries the meaning alone.
        <section className="mt-6 rounded border border-warning-border bg-warning-subtle p-4" aria-labelledby="deadline-heading">
          <h2 id="deadline-heading" className="font-head text-lg font-semibold text-ink">Deadline</h2>
          <p className="mt-1">
            You have <span className="font-semibold">{days}</span> from {route.deadline_runs_from}.
          </p>
          {route.deadline_note && <p className="mt-1 text-sm">{route.deadline_note}</p>}
        </section>
      )}
      {!days && route.deadline_note && <p className="mt-6 text-sm">{route.deadline_note}</p>}

      <section className="mt-6" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="font-head text-lg font-semibold text-primary">What happens next</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-6">
          {route.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <section className="mt-6 rounded border border-border bg-surface p-4" aria-labelledby="track-heading">
        <h2 id="track-heading" className="font-head text-base font-semibold text-primary">Keep track of it</h2>
        {canOwnActivity(user) ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Record what you have done and get a reminder before the deadline.
            </p>
            <Link
              to={`/matters/new?route=${route.id}`}
              className={`mt-3 inline-flex min-h-touch items-center rounded bg-primary 
                px-4 font-head text-sm font-semibold text-primary-foreground ${RING}`}
            >
              Track this matter
            </Link>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Students and staff can <Link to="/login" className={`font-semibold text-primary underline ${RING}`}>sign in</Link> to
            record what they have done and get a reminder before the deadline. Nothing on this page needs an account.
          </p>
        )}
      </section>

      <Disclaimer className="mt-6" />
    </article>
  );
}

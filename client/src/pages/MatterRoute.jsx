import { Link, useParams } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import ErrorNotice from '@/components/ErrorNotice';
import Disclaimer from '@/components/Disclaimer';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ProviderCard from '@/components/ProviderCard';
import RwandaJurisdictionLadder from '@/components/RwandaJurisdictionLadder';
import { readableDays, typeLabel } from '@/lib/directory';
import { secureAddress, signInPath } from '@/lib/url';
import { BUTTON_ON_CHROME, BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_TEXT } from '@/lib/ui';

const SIDE_PANEL = 'rounded-card border border-border bg-surface p-6';

// One matter. The office it goes to first, the law behind that, what happens next and the
// deadline. The server sends a route only when it and its office are both verified.
export default function MatterRoute() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: route, error, loading } = useApi(`/directory/routes/${id}`);

  if (loading) return <p role="status" className="text-muted-foreground">Loading…</p>;
  if (error) {
    return (
      <div>
        <h1 className="font-head text-4xl leading-heading text-primary">This matter is not available</h1>
        <ErrorNotice error={error} className="mt-4" />
        <p className="mt-4">
          <Link to="/where-to-go" className={BUTTON_TEXT}>Back to every matter</Link>
        </p>
      </div>
    );
  }

  const days = readableDays(route.deadline_days);
  const forum = route.first_forum;
  // Only a full https address becomes a link. A stored javascript: value would run when clicked.
  const source = secureAddress(forum.official_source_url);

  return (
    <article>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Where to Go', to: '/where-to-go' }]} current={route.title} />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">{route.title}</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">
        Explore the office this matter goes to first. Confirm that it applies to you before you take action.
      </p>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="first-heading">
            <div className="rounded-t-card border border-b-0 border-chrome-raised bg-chrome p-7 text-chrome-foreground">
              <h2 id="first-heading" className="text-xs font-semibold uppercase tracking-wide text-on-chrome">Go here first</h2>
              <h3 className="mt-3 font-head text-3xl leading-heading">{forum.name}</h3>
              <p className="mt-2 text-sm uppercase tracking-wide text-on-chrome">
                {typeLabel(forum.type)}
                {forum.location ? ` · ${forum.location}` : ''}
              </p>
              {/* The full entry has its own page: the hours, the map and how to ask for a booking. */}
              <Link to={`/directory/${forum.id}`} className={`${BUTTON_ON_CHROME} mt-5`}>
                View directory entry{' '}<span className="sr-only">for {forum.name}</span>
              </Link>
            </div>
            <ul><ProviderCard provider={forum} bare /></ul>
          </section>

          {days && (
            // A deadline cannot be fixed later so it gets its own block. The word "deadline" is in
            // it. Colour never carries the meaning alone.
            <section className="rounded-card border border-warning-border bg-warning-subtle p-5" aria-labelledby="deadline-heading">
              <h2 id="deadline-heading" className="font-head text-2xl text-ink">Deadline</h2>
              <p className="mt-2">
                You have <span className="font-semibold">{days}</span> from {route.deadline_runs_from}.
              </p>
              {route.deadline_note && <p className="mt-1 text-sm">{route.deadline_note}</p>}
            </section>
          )}
          {!days && route.deadline_note && <p className="text-sm">{route.deadline_note}</p>}

          <section aria-labelledby="why-heading">
            <h2 id="why-heading" className="font-head text-2xl text-primary">Why this destination?</h2>
            <p className="mt-2 max-w-reading">{route.legal_basis}</p>
            {route.exclusions && (
              <Callout title="Know the limits" className="mt-3 max-w-reading">{route.exclusions}</Callout>
            )}
          </section>

          <section aria-labelledby="steps-heading">
            <h2 id="steps-heading" className="font-head text-2xl text-primary">What happens next</h2>
            <ol role="list" className="mt-4 flex list-none flex-col gap-3 p-0 [counter-reset:step]">
              {route.steps.map((step, i) => (
                <li
                  key={`${i}-${step}`}
                  className="flex gap-4 bg-surface p-4 [counter-increment:step] before:w-10 before:shrink-0 before:font-head before:text-2xl before:text-warning-strong before:[content:counter(step,decimal-leading-zero)]"
                >
                  {step}
                </li>
              ))}
            </ol>
          </section>

          {(route.matter_type === 'small_civil_claim' || forum.type === 'abunzi') && (
            <RwandaJurisdictionLadder />
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5" aria-label="Sources, timing and tracking">
          <section className={SIDE_PANEL} aria-labelledby="sources-heading">
            <h2 id="sources-heading" className="font-head text-2xl text-primary">Sources &amp; review</h2>
            <dl className="mt-3 flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Official source</dt>
                <dd className="mt-0.5">
                  {source
                    ? <a href={source} target="_blank" rel="noopener noreferrer" className={BUTTON_TEXT}>Open the official page{' '}<span className="sr-only">for {forum.name} (opens in a new tab)</span></a>
                    : 'Not available'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Deadline</dt>
                <dd className="mt-0.5">{days ? `${days} from ${route.deadline_runs_from}` : 'No deadline has been recorded.'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Contact details</dt>
                <dd className="mt-0.5">{forum.contact || 'No contact details have been recorded.'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-card bg-primary-subtle p-5" aria-labelledby="timing-heading">
            <h2 id="timing-heading" className="font-head text-xl text-primary">Concerned about timing?</h2>
            <p className="mt-2 text-sm">
              {days
                ? 'This matter has a recorded deadline. It is in the Deadline block on this page.'
                : 'No deadline is recorded for this matter. That does not mean there is none.'}
              {' '}Ask a legal expert if time may matter.
            </p>
          </section>

          <section className={SIDE_PANEL} aria-labelledby="track-heading">
            <h2 id="track-heading" className="font-head text-2xl text-primary">Keep your own record</h2>
            {canOwnActivity(user) ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Record what you have done and get a reminder before the deadline.
                </p>
                <Link to={`/matters/new?route=${route.id}`} className={`mt-4 ${BUTTON_PRIMARY}`}>Track this matter</Link>
              </>
            ) : user ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Tracking a matter is for students and staff. Nothing on this page needs an account.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Students and staff can sign in to record what they have done and get a reminder before
                  the deadline. Nothing on this page needs an account.
                </p>
                <Link to={signInPath({ pathname: '/matters/new', search: `?route=${route.id}` })} className={`mt-4 ${BUTTON_PRIMARY}`}>Sign in to start tracking</Link>
              </>
            )}
          </section>

          <Link to="/ask" className={`self-start ${BUTTON_OUTLINE}`}>Ask a legal expert</Link>
        </aside>
      </div>

      <Disclaimer className="mt-8" />
    </article>
  );
}

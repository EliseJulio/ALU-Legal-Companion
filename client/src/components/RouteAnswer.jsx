import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import { readableDays, typeLabel } from '@/lib/directory';
import { signInPath } from '@/lib/url';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_TEXT } from '@/lib/ui';
import RwandaJurisdictionLadder from '@/components/RwandaJurisdictionLadder';
import NoMatchPanel from '@/components/NoMatchPanel';

const SECTION = 'mt-6';
const LABEL = 'text-sm font-semibold text-muted-foreground';

// One matter's answer shown inside the guided card. The order is fixed:
// the office then the steps then the law then the deadline then tracking.
// Everything shown comes from the published route.
// The dispute ladder appears only when the office is an Abunzi committee. It starts closed.
// Focus moves to the heading once the answer is ready.
export default function RouteAnswer({ routeId, onBack }) {
  const { user } = useAuth();
  const { data: route, error, loading } = useApi(`/directory/routes/${routeId}`);
  const heading = useRef(null);

  useEffect(() => {
    if (route) heading.current?.focus();
  }, [route]);

  if (loading) return <p role="status" className="mt-4 text-muted-foreground">Loading this matter…</p>;
  if (error) {
    return (
      <NoMatchPanel>
        <p className="font-head text-[15px] leading-[1.3] text-ink">This matter is no longer listed</p>
        <p className="mt-2 text-sm text-muted-foreground">It may have been changed. Browse the directory or ask a legal expert.</p>
      </NoMatchPanel>
    );
  }
  if (!route) return null;

  const days = readableDays(route.deadline_days);
  const forum = route.first_forum;

  return (
    <div className="mt-4">
      <button type="button" onClick={onBack} className={BUTTON_TEXT}>Back to the matters</button>
      <h2 ref={heading} tabIndex={-1} className="mt-3 font-head text-[length:clamp(18px,2vw,22px)] leading-[1.2] text-ink focus:outline-none">
        Where this goes first
      </h2>
      <p className="mt-2 font-head text-[15px] leading-[1.3] text-ink">{route.title}</p>

      <section aria-labelledby="answer-office" className={SECTION}>
        <h3 id="answer-office" className={LABEL}>Go first to</h3>
        <p className="mt-2 font-semibold text-ink">{forum.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {typeLabel(forum.type)}{forum.location ? ` · ${forum.location}` : ''}
        </p>
        <Link to={`/directory/${forum.id}`} className={`mt-3 ${BUTTON_OUTLINE}`}>
          View directory entry<span className="sr-only"> for {forum.name}</span>
        </Link>
      </section>

      <section aria-labelledby="answer-steps" className={SECTION}>
        <h3 id="answer-steps" className={LABEL}>Steps</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {route.steps.map((step, i) => <li key={`${i}-${step}`}>{step}</li>)}
        </ol>
      </section>

      <section aria-labelledby="answer-law" className={SECTION}>
        <h3 id="answer-law" className={LABEL}>The law</h3>
        <p className="mt-2 max-w-reading">{route.legal_basis}</p>
        {route.exclusions && (
          <p className="mt-2 text-sm"><span className="font-semibold">It does not apply if: </span>{route.exclusions}</p>
        )}
      </section>

      <section aria-labelledby="answer-deadline" className={SECTION}>
        <h3 id="answer-deadline" className={LABEL}>Deadline</h3>
        {days ? (
          <p className="mt-2">You have <span className="font-semibold">{days}</span> from {route.deadline_runs_from}.</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No deadline has been recorded for this matter. That does not mean there is none.</p>
        )}
        {route.deadline_note && <p className="mt-1 text-sm">{route.deadline_note}</p>}
      </section>

      {forum.type === 'abunzi' && <RwandaJurisdictionLadder />}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canOwnActivity(user) ? (
          <Link to={`/matters/new?route=${route.id}`} className={BUTTON_PRIMARY}>Track this matter</Link>
        ) : user ? (
          <p className="text-sm text-muted-foreground">Tracking a matter is for students and staff.</p>
        ) : (
          <Link to={signInPath({ pathname: '/matters/new', search: `?route=${route.id}` })} className={BUTTON_PRIMARY}>
            Sign in to start tracking
          </Link>
        )}
        <Link to="/ask" className={BUTTON_OUTLINE}>Ask a legal expert</Link>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Legal information, not legal advice. The office, steps and deadline come from a matter an admin published.
      </p>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import OwnerOnly from '@/components/OwnerOnly';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import { readableDays } from '@/lib/directory';
import { todayIso } from '@/lib/dates';
import { RING_ON_CANVAS, FIELD, DATE_FIELD, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

function NewMatterForm() {
  const [params] = useSearchParams();
  const routeId = params.get('route');
  const navigate = useNavigate();
  // With no route id the path is empty and nothing is requested.
  const { data: route, error: routeError, loading } = useApi(routeId ? `/directory/routes/${routeId}` : null);

  const [title, setTitle] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [start, setStart] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    // From a route the SERVER works out the deadline from the verified number of days. The page
    // only says when the clock started. Without a route the reader types the date.
    const body = route
      ? {
          route_id: route.id,
          title: title.trim() || undefined,
          next_action: nextAction.trim() || undefined,
          deadline_start: route.deadline_days && start ? start : undefined,
        }
      : { title: title.trim(), next_action: nextAction.trim() || null, next_due: nextDue || null };
    try {
      const matter = await apiPost('/matters', body);
      navigate(`/matters/${matter.id}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  if (routeId && loading) return <p className="text-muted-foreground">Loading…</p>;
  if (routeId && routeError) return <ErrorNotice error={routeError} />;

  const days = route ? readableDays(route.deadline_days) : null;

  return (
    <form onSubmit={save}>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'My Matters', to: '/matters' }]} current="New matter" />
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-head text-4xl leading-heading text-primary md:text-5xl">New matter</h1>
        <Link to="/matters" className={`inline-flex min-h-touch items-center font-semibold text-info underline underline-offset-2 ${RING_ON_CANVAS}`}>
          <span aria-hidden="true">←&nbsp;</span>Return to My Matters
        </Link>
      </div>
      <p className="mt-4 max-w-reading text-muted-foreground">
        A short record of your next step. Only you can see it unless you explicitly choose to share it.
      </p>
      <Callout title="Private by default" className="mt-4">
        Your record stays private until you choose an expert to share it with. Leave a deadline
        blank if you do not know it.
      </Callout>
      {route && (
        <p className="mt-4 text-muted-foreground">
          For: <span className="font-semibold text-ink">{route.title}</span>. First step: {route.first_forum.name}.
        </p>
      )}

      <div className="mt-6 rounded-card border border-border bg-surface p-6">
        <label htmlFor="matter-title" className="block text-sm font-medium">
          Private name <span className="text-muted-foreground">{route ? '(optional)' : '(required)'}</span>
        </label>
        <input
          id="matter-title"
          aria-describedby="matter-title-hint"
          aria-required={route ? undefined : true}
          type="text"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={route ? route.title : 'e.g. Deposit from my old flat'}
          className={FIELD}
        />
        <p id="matter-title-hint" className="mt-1 text-sm text-muted-foreground">
          Use a short name you can recognise. Avoid unnecessary identifying details. Reminder emails never include it.
        </p>

        <label htmlFor="matter-next" className="mt-4 block text-sm font-medium">Next step</label>
        <input
          id="matter-next"
          type="text"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          placeholder={route ? route.steps[0] : ''}
          className={FIELD}
        />

        {route && days && (
          <div className="mt-4 rounded border border-warning-border bg-warning-subtle p-4">
            <label htmlFor="matter-start" className="block text-sm font-medium">When was {route.deadline_runs_from}?</label>
            <p id="matter-start-hint" className="text-xs">You have {days} from that day. We will work out the date and remind you before it.</p>
            <input id="matter-start" type="date" max={todayIso()} value={start} onChange={(e) => setStart(e.target.value)} aria-describedby="matter-start-hint matter-start-hint2" className={DATE_FIELD} />
            <p id="matter-start-hint2" className="mt-1 text-xs">Leave it empty if it has not happened yet. You can add the date later.</p>
          </div>
        )}

        {!route && (
          <>
            <label htmlFor="matter-due" className="mt-4 block text-sm font-medium">Known deadline (optional)</label>
            <p id="matter-due-hint" className="mt-1 text-sm text-muted-foreground">Leave this blank if no date has been confirmed.</p>
            <input id="matter-due" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} aria-describedby="matter-due-hint" className={DATE_FIELD} />
            <p className="mt-2 text-sm text-muted-foreground">
              Want the date worked out for you?{' '}
              <Link to="/where-to-go" className={`font-semibold text-info underline underline-offset-2 ${RING_ON_CANVAS}`}>Start from Where to Go</Link>{' '}
              and choose your situation.
            </p>
          </>
        )}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Reminders are a courtesy. We email you 7 days and 1 day before. Meeting the deadline stays your responsibility.
      </p>

      {error && <ErrorNotice error={error} className="mt-4" />}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" aria-disabled={busy || undefined} aria-busy={busy} className={BUTTON_PRIMARY}>Create private matter</button>
        <Link to="/matters" className={BUTTON_OUTLINE}>Cancel</Link>
      </div>
    </form>
  );
}

export default function NewMatter() {
  return <OwnerOnly><NewMatterForm /></OwnerOnly>;
}

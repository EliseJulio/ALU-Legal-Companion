import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import OwnerOnly from '@/components/OwnerOnly';
import ErrorNotice from '@/components/ErrorNotice';
import { readableDays } from '@/lib/directory';
import { todayIso } from '@/lib/dates';
import { FIELD, DATE_FIELD, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

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
      <h1 className="font-head text-2xl text-primary">Track a matter</h1>
      {route && (
        <p className="mt-1 text-muted-foreground">
          For: <span className="font-semibold text-ink">{route.title}</span>. First step: {route.first_forum.name}.
        </p>
      )}

      <div className="mt-4 rounded border border-border bg-surface p-4">
        <label htmlFor="matter-title" className="block text-sm font-medium">
          A short name for it {route && <span className="text-muted-foreground">(optional)</span>}
        </label>
        <input
          id="matter-title"
          type="text"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={route ? route.title : 'e.g. Deposit from my old flat'}
          className={FIELD}
        />
        <p className="mt-1 text-xs text-muted-foreground">Only you can see this. Reminder emails never include it.</p>

        <label htmlFor="matter-next" className="mt-4 block text-sm font-medium">What you will do next</label>
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
            <p className="text-xs">You have {days} from that day. We will work out the date and remind you before it.</p>
            <input id="matter-start" type="date" max={todayIso()} value={start} onChange={(e) => setStart(e.target.value)} className={DATE_FIELD} />
            <p className="mt-1 text-xs">Leave it empty if it has not happened yet. You can add the date later.</p>
          </div>
        )}

        {!route && (
          <>
            <label htmlFor="matter-due" className="mt-4 block text-sm font-medium">Deadline, if you know one</label>
            <input id="matter-due" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className={DATE_FIELD} />
          </>
        )}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Reminders are a courtesy. We email you 7 days and 1 day before. Meeting the deadline stays your responsibility.
      </p>

      {error && <ErrorNotice error={error} className="mt-4" />}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" disabled={busy} aria-busy={busy} className={BUTTON_PRIMARY}>Start tracking</button>
        <Link to="/matters" className={BUTTON_OUTLINE}>Cancel</Link>
      </div>
    </form>
  );
}

export default function NewMatter() {
  return <OwnerOnly><NewMatterForm /></OwnerOnly>;
}

import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import OwnerOnly from '@/components/OwnerOnly';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import { dueInWords, readableDay, daysUntil } from '@/lib/dates';
import { RING_ON_CANVAS, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

// A person's own matters. The server sends the soonest deadline first and finished ones last.
function MatterList() {
  const { data: matters, error, loading } = useApi('/matters');

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">My matters</h1>
      <p className="mt-1 text-muted-foreground">
        Keep a record of what you have done and what comes next. Only you can see these unless you
        choose to share one with a legal expert.
      </p>
      <p className="mt-4 flex flex-wrap gap-3">
        <Link to="/where-to-go" className={BUTTON_PRIMARY}>Start from where to go</Link>
        <Link to="/matters/new" className={BUTTON_OUTLINE}>Open a blank matter</Link>
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Loading your matters…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {matters?.length === 0 && (
        <p className="mt-6 rounded border border-border bg-surface p-4 text-muted-foreground">
          You are not tracking anything yet.
        </p>
      )}

      {matters?.length > 0 && (
        <ul className="mt-6 space-y-3">
          {matters.map((m) => {
            const days = daysUntil(m.next_due);
            // A deadline within a week is stressed in words as well as in colour.
            const urgent = m.status === 'open' && days !== null && days <= 7;
            return (
              <li key={m.id}>
                <Link to={`/matters/${m.id}`} className={`block rounded border border-border bg-surface p-4 hover:border-primary ${RING_ON_CANVAS}`}>
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-head font-semibold text-primary">{m.title}</span>
                    <StatusPill status={m.status} />
                  </span>
                  {m.next_action && <span className="mt-1 block text-sm">Next: {m.next_action}</span>}
                  {m.next_due && (
                    <span className={`mt-1 block text-sm ${urgent ? 'font-semibold text-warning-strong' : 'text-muted-foreground'}`}>
                      Deadline {readableDay(m.next_due)} ({dueInWords(m.next_due)})
                    </span>
                  )}
                  {m.shared_with_name && (
                    <span className="mt-1 block text-xs text-muted-foreground">Shared with {m.shared_with_name}</span>
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

export default function MyMatters() {
  const { user } = useAuth();
  // The list is requested only inside the guard. A visitor never sends a request that would 401.
  return <OwnerOnly>{canOwnActivity(user) && <MatterList />}</OwnerOnly>;
}

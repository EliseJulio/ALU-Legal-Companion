import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import { dueInWords, readableDay } from '@/lib/dates';
import { PANEL, RING_ON_CANVAS } from '@/lib/ui';

// Matters that students and staff chose to share with the directory entry linked to this
// account. The owner is never named here. Opening one shows the record and a box for a note.
export default function ExpertMatters() {
  const { data: matters, error, loading } = useApi('/matters/shared');

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Shared matters</h1>
      <p className="mt-1 text-muted-foreground">
        Matters that students and staff have shared with you. You can read each record and add
        notes. You do not see who shared it unless they tell you in the record.
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {matters?.length === 0 && <p className={`mt-6 text-muted-foreground ${PANEL}`}>Nobody is sharing a matter with you right now.</p>}

      <ul className="mt-6 space-y-3">
        {matters?.map((matter) => (
          <li key={matter.id}>
            <Link to={`/matters/${matter.id}`} className={`block ${PANEL} hover:border-primary ${RING_ON_CANVAS}`}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-head font-semibold text-primary">{matter.title}</span>
                <StatusPill status={matter.status} />
              </span>
              {matter.route_title && <span className="mt-1 block text-sm text-muted-foreground">{matter.route_title}</span>}
              {matter.next_due && (
                <span className="mt-1 block text-sm font-semibold">
                  Deadline {readableDay(matter.next_due)} ({dueInWords(matter.next_due)})
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

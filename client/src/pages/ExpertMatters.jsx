import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
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
      <Breadcrumb trail={[{ label: 'Expert workspace' }]} current="Shared matters" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Records shared with you.</h1>
      <p className="mt-3 max-w-reading text-muted-foreground">
        Access is granted by the member and can be revoked immediately. You can read each record and
        add notes. You do not see who shared it unless they tell you in the record.
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {matters?.length === 0 && <p className={`mt-6 text-muted-foreground ${PANEL}`}>Nobody is sharing a matter with you right now.</p>}

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {matters?.map((matter) => (
          <li key={matter.id}>
            <Link to={`/matters/${matter.id}`} className={`block ${PANEL} hover:border-primary ${RING_ON_CANVAS}`}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-sans font-semibold text-primary">{matter.title}</span>
                <StatusPill status={matter.status} />
              </span>
              <span className="mt-2 block text-sm">Shared record only. No member name or email.</span>
              {matter.route_title && <span className="mt-1 block text-sm text-muted-foreground">{matter.route_title}</span>}
              {matter.next_due && (
                <span className="mt-1 block text-sm font-semibold">
                  Deadline {readableDay(matter.next_due)} ({dueInWords(matter.next_due)})
                </span>
              )}
              <span className="mt-2 block text-xs text-muted-foreground">The member can revoke access immediately.</span>
              <span aria-hidden="true" className="mt-3 inline-flex min-h-button items-center rounded border border-primary px-5 text-sm font-semibold text-primary">Open shared record →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

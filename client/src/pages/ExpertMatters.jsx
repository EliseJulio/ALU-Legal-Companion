import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import { readableDay } from '@/lib/dates';
import { matterDeadline } from '@/lib/overview';
import StatusWord from '@/components/overview/StatusWord';
import { CARD, RING, PAGE_TITLE } from '@/lib/ui';

// Matters that students and staff chose to share with the directory entry linked to this
// account. The owner is never named here. Opening one shows the record and a box for a note.
export default function ExpertMatters() {
  const { data, error, loading } = useApi('/matters/shared');
  // A reply that is not a list (for example an error body) is shown as no matters, not a crash.
  const matters = Array.isArray(data) ? data : null;

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Expert workspace' }]} current="Shared matters" />
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Records shared with you</h1>
      <p className="mt-2.5 max-w-reading text-sm text-muted-foreground">
        Access is granted by the member and can be revoked immediately. You can read each record and
        add notes. You do not see who shared it unless they tell you in the record.
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {matters?.length === 0 && <p className={`mt-6 text-muted-foreground ${CARD}`}>Nobody is sharing a matter with you right now.</p>}

      {/* One card with a row per matter. */}
      {/* No overflow clip here: it would cut off the focus ring of the first and last row. Each row takes
          the card's corners instead, so its own colour stops at the card's edge. */}
      <ul className="mt-6 min-w-0 rounded-card border border-border bg-surface">
        {matters?.map((matter) => (
          <li key={matter.id} className="relative border-t border-border first:border-t-0 focus-within:z-10 first:[&>a]:rounded-t-card last:[&>a]:rounded-b-card">
            <Link to={`/matters/${matter.id}`} className={`block p-[18px] hover:bg-chrome-raised ${RING} focus-visible:ring-offset-surface`}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-sans text-sm font-semibold text-ink">{matter.title}</span>
                <StatusPill status={matter.status} />
              </span>
              {/* One short line under the title: the route the matter follows. */}
              {matter.route_title && <span className="mt-1 block text-sm text-muted-foreground">{matter.route_title}</span>}
              {matter.next_due && (
                <span className="mt-1 block text-sm font-semibold text-ink">
                  Deadline {readableDay(matter.next_due)} ({matterDeadline(matter.next_due, matter.status)?.words}){' '}
                  {matterDeadline(matter.next_due, matter.status)?.late && <StatusWord word="Late" tone="urgent" />}
                </span>
              )}
              {/* Said in words and in the card, so the lawyer knows without opening each matter. */}
              {matter.documents_waiting > 0 && (
                <span className="mt-2 inline-block rounded-control border border-primary px-3 py-1 text-xs font-semibold text-primary-text">
                  {matter.documents_waiting === 1 ? '1 document waiting for your check' : `${matter.documents_waiting} documents waiting for your check`}
                </span>
              )}
              {/* The privacy and revoke sentences, as one note at the foot of the row. */}
              <span className="mt-2 block text-xs text-muted-foreground">Shared record only. No member name or email. The member can revoke access immediately.</span>
              <span aria-hidden="true" className="mt-3 inline-flex min-h-touch items-center rounded-control border border-primary px-5 text-sm font-semibold text-primary-text">Open shared record →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import { PANEL, RING } from '@/lib/ui';

const REVIEW_WORDS = { draft: 'Draft', pending_review: 'Waiting for review', published: 'Published' };

// A group of counts. Counts only. There are no names and nothing about what one person did.
function Counts({ title, rows, to }) {
  return (
    <section className={PANEL} aria-label={title}>
      <h2 className="font-head text-xl leading-heading text-primary">
        {to ? <Link to={to} className={`underline ${RING}`}>{title}</Link> : title}
      </h2>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const review = (counts) => Object.entries(REVIEW_WORDS).map(([key, label]) => [label, counts[key]]);

// What is happening on the platform, as numbers. It exists so the admin can see what is waiting
// and what is stale. It does not show any person.
export default function AdminDashboard() {
  const { data: stats, error, loading } = useApi('/admin/stats');

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Overview" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Overview</h1>
      <p className="mt-3 max-w-reading text-muted-foreground">
        Operational totals and management shortcuts. Counts only. No private questions, case
        details or individual activity.
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Counts title="Guides" to="/admin/guides" rows={review(stats.guides)} />
          <Counts
            title="Directory entries"
            to="/admin/providers"
            rows={[...review(stats.directory.providers), ['Not re-checked for six months', stats.directory.stale]]}
          />
          <Counts title="Routes" to="/admin/routes" rows={review(stats.directory.routes)} />
          <Counts
            title="Questions"
            rows={[['Asked', stats.questions.total], ['Asked anonymously', stats.questions.anonymous], ['Still open', stats.questions.open]]}
          />
          <Counts
            title="Appointments"
            rows={[
              ['Requested in all', stats.bookings.total],
              ['Anonymous', stats.bookings.anonymous],
              ['Waiting', stats.bookings.by_status.requested],
              ['Accepted', stats.bookings.by_status.accepted],
              ['Declined', stats.bookings.by_status.declined],
              ['Completed', stats.bookings.by_status.completed],
            ]}
          />
          <Counts
            title="Tracked matters"
            rows={[['Opened', stats.matters.total], ['Open now', stats.matters.open], ['Shared with an expert', stats.matters.shared]]}
          />
          <Counts
            title="Reminders"
            rows={[
              ['Scheduled', stats.reminders.pending],
              ['Sent', stats.reminders.sent],
              ['Sent after the deadline', stats.reminders.sent_late],
              ['Not sent in time', stats.reminders.missed],
              ['Cancelled', stats.reminders.cancelled],
            ]}
          />
          <Counts
            title="People"
            to="/admin/users"
            rows={[
              ['Students', stats.users.student],
              ['Staff', stats.users.staff],
              ['Legal experts', stats.users.legal_expert],
              ['Administrators', stats.users.admin],
              ['Switched off', stats.users.deactivated],
            ]}
          />
        </div>
      )}

      <p className="mt-8 max-w-reading border-t border-border pt-4 text-sm text-muted-foreground">
        Admins write, check and publish content. Editing a published item takes it off the site until it is
        published again. Invitations control expert onboarding.
      </p>
    </div>
  );
}

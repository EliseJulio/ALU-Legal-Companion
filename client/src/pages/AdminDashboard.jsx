import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useApi } from '@/lib/useApi';
import { useNow } from '@/lib/useNow';
import ErrorNotice from '@/components/ErrorNotice';
import FigureStrip from '@/components/overview/FigureStrip';
import WeeklyChart from '@/components/overview/WeeklyChart';
import Panel from '@/components/overview/Panel';
import {
  greeting, figureOf, unpublishedGuides, checkedEntries, reminderDelivery, weekBounds, weekScheduled,
} from '@/lib/overview';
import { BUTTON_OUTLINE } from '@/lib/ui';
import { CARD, RING } from '@/lib/ui';

// Draft and Published are the two states the admin sees. A guide, entry or route that is not
// published yet is a draft. The admin writes and publishes, so no other word is needed here.
const review = (counts) => [['Draft', counts.draft + counts.pending_review], ['Published', counts.published]];

// A group of counts. Counts only. There are no names and nothing about what one person did.
function Counts({ title, rows, to }) {
  return (
    <section className={CARD} aria-label={title}>
      <h2 className="font-head text-base leading-[1.3] text-ink">
        {to ? <Link to={to} className={`inline-flex min-h-touch items-center hover:underline ${RING}`}>{title}</Link> : title}
      </h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-mono font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// What is happening on the platform, as numbers. It exists so the admin can see what is waiting
// and what is stale. It does not show any person.
export default function AdminDashboard() {
  const { user } = useAuth();
  const stats = useApi('/admin/stats');
  // The entries list is read only for the count of entries checked in the last 30 days.
  const providers = useApi('/directory/providers/all');
  // This week's consultations. The window is a day wider each side because the server counts days in
  // UTC and the week is the reader's own. The exact week is cut out again in weekScheduled.
  const now = useNow();
  const { start, end } = weekBounds(now);
  const day = (d, by) => new Date(d.getTime() + by * 86400000).toISOString().slice(0, 10);
  const bookings = useApi(`/admin/bookings?from=${day(start, -1)}&to=${day(end, 1)}`);
  const { data, error, loading } = stats;

  const checked = checkedEntries(providers.data ?? [], now);
  const delivery = reminderDelivery(data?.reminders);

  const figures = [
    figureOf('Guides not published yet', [stats], {
      value: unpublishedGuides(data?.guides ?? {}),
      note: 'Drafts the admin has not published',
    }),
    figureOf('Directory entries checked', [providers], {
      value: checked.total === 0 ? 'None yet' : `${checked.checked} of ${checked.total}`,
      note: 'Published, checked in the last 30 days',
    }),
    figureOf('Reminders delivered', [stats], {
      value: delivery.percent === null ? 'None yet' : `${delivery.percent}%`,
      note: `All time. ${delivery.missed} not sent in time`,
    }),
    figureOf('Questions unanswered', [stats], {
      value: data?.questions.open ?? 0,
      // The server decides what overdue means and sends the number of days with it.
      note: data?.questions.overdue > 0
        ? `${data.questions.overdue} overdue, waiting over ${data.answer_target_days} days`
        : 'None overdue',
    }),
  ];

  return (
    <div className="wide:-mx-2.5">
      <header className="wide:px-2.5">
        <h1 className="font-head text-[length:clamp(24px,2.7vw,30px)] leading-[1.15] tracking-[-0.01em] text-ink">{greeting(user)}</h1>
        <p className="mt-2.5 max-w-reading text-sm leading-[1.6] text-muted-foreground">
          Operational totals and management shortcuts. Counts only. No private questions, case
          details or individual activity.
        </p>
      </header>

      {loading && <p className="mt-5 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-5" />}

      <FigureStrip figures={figures} />

      <div className="mt-5 grid gap-3 lg:grid-cols-12">
        <WeeklyChart weeks={data?.weekly} loading={loading} error={error} className="lg:col-span-8" />
        <Panel id="week-appointments" title="Appointments this week" className="lg:col-span-4">
          {bookings.error ? <ErrorNotice error={bookings.error} /> : bookings.loading ? <p className="text-muted-foreground">Loading…</p> : (
            <>
              <p className="flex items-baseline gap-2">
                <span className="font-sans text-[40px] font-medium leading-none tracking-tight text-ink">{weekScheduled(bookings.data, now)}</span>
                <span className="text-[15px] text-muted-foreground">scheduled</span>
              </p>
              <p className="mb-4 mt-2.5 text-sm text-muted-foreground">View only for admins.</p>
              <Link to="/admin/calendar" className={BUTTON_OUTLINE}>Open the calendar</Link>
            </>
          )}
        </Panel>
      </div>

      {data && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Counts title="Guides" to="/admin/guides" rows={review(data.guides)} />
          <Counts
            title="Directory entries"
            to="/admin/providers"
            rows={[...review(data.directory.providers), ['Not re-checked for six months', data.directory.stale]]}
          />
          <Counts title="Routes" to="/admin/routes" rows={review(data.directory.routes)} />
          <Counts
            title="Questions"
            rows={[['Asked', data.questions.total], ['Asked anonymously', data.questions.anonymous], ['Still open', data.questions.open]]}
          />
          <Counts
            title="Appointments"
            rows={[
              ['Requested in all', data.bookings.total],
              ['Anonymous', data.bookings.anonymous],
              ['Waiting', data.bookings.by_status.requested],
              ['Accepted', data.bookings.by_status.accepted],
              ['Declined', data.bookings.by_status.declined],
              ['Completed', data.bookings.by_status.completed],
            ]}
          />
          <Counts
            title="Tracked matters"
            rows={[['Opened', data.matters.total], ['Open now', data.matters.open], ['Shared with an expert', data.matters.shared]]}
          />
          <Counts
            title="Reminders"
            rows={[
              ['Scheduled', data.reminders.pending],
              ['Sent', data.reminders.sent],
              ['Sent after the deadline', data.reminders.sent_late],
              ['Not sent in time', data.reminders.missed],
              ['Cancelled', data.reminders.cancelled],
            ]}
          />
          <Counts
            title="People"
            to="/admin/users"
            rows={[
              ['Students', data.users.student],
              ['Staff', data.users.staff],
              ['Legal experts', data.users.legal_expert],
              ['Administrators', data.users.admin],
              ['Switched off', data.users.deactivated],
            ]}
          />
        </div>
      )}
    </div>
  );
}

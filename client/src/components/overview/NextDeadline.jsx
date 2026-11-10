import Panel from '@/components/overview/Panel';
import CardState from '@/components/overview/CardState';
import DeadlineBar from '@/components/overview/DeadlineBar';
import { useApi } from '@/lib/useApi';
import { daysLeft, deadlineWords, reminderFor, barSpan, plural, BAR_DAYS } from '@/lib/overview';
import { readableDay } from '@/lib/dates';

// One label and one value in the row of three under the figure. The words are small, the value is
// medium and ink.
function Cell({ label, children }) {
  return (
    <div className="min-w-0 px-3 py-2.5 text-xs text-muted-foreground">
      <p>{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{children}</p>
    </div>
  );
}

// The words for the reminder row, from the reminders of this matter.
function reminderWords(reminder) {
  if (reminder.kind === 'pending') {
    return `${reminder.before} ${plural(reminder.before, 'day')} before, on ${readableDay(reminder.send_on)}`;
  }
  if (reminder.kind === 'sent') return 'Sent. No reminder is left to send';
  return 'No reminder is set for this deadline';
}

// The one matter with the soonest deadline. The office and the law come from its route, which is
// fetched here because only this card needs them.
export default function NextDeadline({ matter, loading, error, reminders, loadingReminders, errorReminders, today }) {
  // An empty path asks for nothing, which is right for a matter that did not start from a route.
  const route = useApi(matter?.route_id ? `/directory/routes/${matter.route_id}` : null);
  const left = matter ? daysLeft(matter, today) : null;
  const reminder = matter ? reminderFor(reminders, matter.id, today) : null;
  const first = route.data?.first_forum?.name;

  const big = left === null ? null : left === 0 ? 'Today' : left < 0 ? -left : left;
  const bigWords = left === null ? '' : left < 0 ? 'days late' : left === 0 ? '' : 'days left';

  return (
    <Panel id="next-deadline" title="Next deadline" className="lg:col-span-7">
      <CardState
        loading={loading}
        error={error}
        empty={!matter && <p>No open matter has a deadline yet.</p>}
      >
        {matter && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-sans text-[40px] font-medium leading-none tracking-tight text-ink">{big}</span>
                <span className="text-[15px] text-muted-foreground">{bigWords}</span>
              </div>
              <div className="min-w-0 text-right text-sm">
                <p className="font-semibold text-ink">Due {readableDay(matter.next_due)}</p>
                <p className="break-words text-muted-foreground">{matter.title}</p>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{deadlineWords(left)}</p>

            <div className="mb-3.5 mt-4 grid divide-y divide-border overflow-hidden rounded-card bg-chrome-raised sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Cell label="Go first to">
                {matter.route_id
                  ? (route.error ? 'Not available' : route.loading ? 'Loading' : first ?? 'Not available')
                  : 'Not set'}
              </Cell>
              <Cell label="Why there">
                {matter.route_id
                  ? (route.error ? 'Not available' : route.loading ? 'Loading' : route.data?.legal_basis ?? 'Not available')
                  : 'You did not start this matter from a route'}
              </Cell>
              <Cell label="Reminder">
                {loadingReminders ? 'Loading' : errorReminders ? 'Not available' : reminderWords(reminder)}
              </Cell>
            </div>

            {/* The bar is the last 30 days. Outside them it would be empty, so it is not drawn. */}
            {left !== null && left >= 0 && left <= BAR_DAYS && <DeadlineBar left={left} span={barSpan(matter, today)} />}
            {(left === null || left < 0 || left > BAR_DAYS) && (
              <p className="mt-3 text-xs text-muted-foreground">
                {left !== null && left < 0 ? 'This deadline has passed.' : `More than ${BAR_DAYS} days to go.`}
              </p>
            )}
          </>
        )}
      </CardState>
    </Panel>
  );
}

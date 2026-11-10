import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity, hasRole } from '@/lib/auth';
import { useNow } from '@/lib/useNow';
import OwnerOnly from '@/components/OwnerOnly';
import Breadcrumb from '@/components/Breadcrumb';
import ErrorNotice from '@/components/ErrorNotice';
import ScheduleCalendar from '@/components/ScheduleCalendar';
import { buildItems, undatedOpenCount } from '@/lib/schedule';
import { BUTTON_OUTLINE, PAGE_TITLE, CARD } from '@/lib/ui';

// One page for the whole schedule: the student's consultations and the deadlines of their open matters.
// Both lists come from the server for this account only.
// A list that fails is named. The other list still shows.
function CalendarBoard() {
  const bookings = useApi('/bookings/mine');
  const matters = useApi('/matters');
  const today = useNow();

  const items = useMemo(
    () => buildItems(bookings.data ?? [], matters.data ?? [], today),
    [bookings.data, matters.data, today],
  );

  const waiting = (!bookings.data && !bookings.error) || (!matters.data && !matters.error);
  if (waiting) return <p className="mt-6 text-muted-foreground">Loading your calendar…</p>;

  const undated = undatedOpenCount(matters.data ?? [], today);
  // Nothing is claimed as empty while one of the two lists has failed to load.
  const nothing = items.length === 0 && !bookings.error && !matters.error;

  return (
    <div className="mt-6">
      {bookings.error && <ErrorNotice error={bookings.error} className="mb-4" />}
      {matters.error && <ErrorNotice error={matters.error} className="mb-4" />}

      {nothing ? (
        <div className={`mb-4 ${CARD}`}>
          <p className="font-medium">You have no consultations and no matter deadlines yet.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link to="/directory" className={BUTTON_OUTLINE}>Find a lawyer</Link>
            <Link to="/matters/new" className={BUTTON_OUTLINE}>Start a matter</Link>
          </div>
        </div>
      ) : null}

      <ScheduleCalendar items={items} today={today} />

      {undated > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {undated === 1 ? 'One open matter has' : `${undated} open matters have`} no known deadline, so {undated === 1 ? 'it is' : 'they are'} not on the calendar.
        </p>
      )}
    </div>
  );
}

export default function Calendar() {
  const { user } = useAuth();
  // A lawyer or an admin who opens this address is sent to their own calendar, not to a dead end.
  if (hasRole(user, ['legal_expert'])) return <Navigate to="/expert/calendar" replace />;
  if (hasRole(user, ['admin'])) return <Navigate to="/admin/calendar" replace />;
  // Only a student or staff member has bookings and matters. The server refuses anyone else.
  // The page asks for nothing on their behalf.
  return (
    <OwnerOnly signInTitle="Sign in to see your calendar" forbiddenTitle="The calendar is for students and staff">
      {canOwnActivity(user) && (
        <div>
          <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Calendar" />
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className={PAGE_TITLE}>Calendar</h1>
              <p className="mt-3 max-w-reading text-muted-foreground">
                Your consultations and the deadlines of your open matters, in one place. A request is not a
                confirmed appointment until the lawyer accepts it.
              </p>
            </div>
            <Link to="/directory" className={BUTTON_OUTLINE}>Book a consultation</Link>
          </div>
          <CalendarBoard />
        </div>
      )}
    </OwnerOnly>
  );
}

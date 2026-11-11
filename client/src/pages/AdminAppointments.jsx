import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import ErrorNotice from '@/components/ErrorNotice';
import AppointmentGroups from '@/components/AppointmentGroups';
import { ViewOnlyRow } from '@/pages/AdminCalendar';
import { useApi } from '@/lib/useApi';
import { LIVE } from '@/lib/live';
import { useNow } from '@/lib/useNow';
import { useScrollToHash } from '@/lib/useScrollToHash';
import { adminItems } from '@/lib/schedule';
import { BUTTON_OUTLINE, CARD, PAGE_TITLE } from '@/lib/ui';

const GROUPS = {
  accepted: { id: 'appointments-upcoming', title: 'Upcoming', note: null },
  requested: { id: 'appointments-waiting', title: 'Requested', note: 'Waiting for the lawyer to answer.' },
};

// Every consultation across the directory in three lists. It is VIEW ONLY.
// Requesters are never shown. The rows come from GET /api/admin/bookings.
export default function AdminAppointments() {
  const { data, error, loading } = useApi('/admin/bookings', LIVE);
  const now = useNow();
  const items = useMemo(() => adminItems(data ?? [], now), [data, now]);
  useScrollToHash(Boolean(data));

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Appointments" />
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className={PAGE_TITLE}>Appointments</h1>
          <p className="mt-2 max-w-reading text-muted-foreground">
            Every consultation across the directory, so you can see how busy it is.
          </p>
          <p className="mt-3 max-w-reading text-sm">
            <span className="font-semibold text-ink">View only.</span>{' '}
            You cannot accept, decline or join a consultation here, and requesters are not shown.
          </p>
        </div>
        <Link to="/admin/calendar" className={BUTTON_OUTLINE}>See the calendar</Link>
      </div>

      {error && <ErrorNotice error={error} className="mt-6" />}
      {loading && !data && <p className="mt-6 text-muted-foreground">Loading…</p>}

      {data && data.length === 0 && (
        <div className={`mt-6 ${CARD}`}>
          <p className="font-medium">No consultations have been booked yet.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <AppointmentGroups
          items={items}
          groups={GROUPS}
          showDate={false}
          renderRow={(item) => <ViewOnlyRow item={item} />}
        />
      )}
    </div>
  );
}

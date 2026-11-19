import { useMemo } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import ErrorNotice from '@/components/ErrorNotice';
import ScheduleCalendar from '@/components/ScheduleCalendar';
import ViewOnlyRow from '@/components/ViewOnlyRow';
import { useApi } from '@/lib/useApi';
import { LIVE } from '@/lib/live';
import { useNow } from '@/lib/useNow';
import { ADMIN_LEGEND, adminItems } from '@/lib/schedule';
import { PAGE_TITLE } from '@/lib/ui';

// The admin's calendar. It is VIEW ONLY. You cannot accept or decline or join a consultation here.
// Requesters are never shown.
// The rows come from GET /api/admin/bookings. It holds only the id and the slot and the status and the provider's name.
// The calendar waits for the list so an empty month while it loads cannot read as no consultations.
export default function AdminCalendar() {
  const { data, error, loading } = useApi('/admin/bookings', LIVE);
  const now = useNow();
  const items = useMemo(() => adminItems(data ?? [], now), [data, now]);

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Calendar" />
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Calendar</h1>
      <p className="mt-2 max-w-reading text-muted-foreground">
        Every scheduled consultation across the directory, so you can see how busy the week is.
      </p>
      <p className="mt-3 max-w-reading text-sm">
        <span className="font-semibold text-ink">View only.</span>{' '}
        You cannot accept, decline or join a consultation here, and requesters are not shown.
      </p>

      {error && <ErrorNotice error={error} className="mt-6" />}
      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}

      {!loading && !error && data && (
        <div className="mt-6">
          <ScheduleCalendar items={items} today={now} legend={ADMIN_LEGEND} renderRow={(item) => <ViewOnlyRow item={item} />} />
        </div>
      )}
    </div>
  );
}

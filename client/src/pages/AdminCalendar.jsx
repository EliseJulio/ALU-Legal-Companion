import { useMemo } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import ErrorNotice from '@/components/ErrorNotice';
import ScheduleCalendar from '@/components/ScheduleCalendar';
import { ScheduleMark } from '@/components/ScheduleItem';
import { useApi } from '@/lib/useApi';
import { useNow } from '@/lib/useNow';
import { CONSULT_LEGEND, adminItems, longDay } from '@/lib/schedule';
import { PAGE_TITLE } from '@/lib/ui';

// One item for the admin. It names the provider and the state and nothing else.
// There is no action and no requester and no topic on this page. The admin's rows do not carry those fields.
function ViewOnlyRow({ item }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1.5">
        <ScheduleMark mark={item.mark} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tabular-nums text-ink">
          {item.word}{item.time ? ` · ${item.time}` : ''}
        </p>
        <p className="mt-0.5 break-words font-semibold text-ink">{item.title}</p>
        <p className="break-words text-sm text-muted-foreground">{longDay(item.date)}</p>
      </div>
    </div>
  );
}

// The admin's calendar. It is VIEW ONLY. You cannot accept or decline or join a consultation here.
// Requesters are never shown.
// The rows come from GET /api/admin/bookings. It holds only the id and the slot and the status and the provider's name.
// The calendar waits for the list so an empty month while it loads cannot read as no consultations.
export default function AdminCalendar() {
  const { data, error, loading } = useApi('/admin/bookings');
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
          <ScheduleCalendar items={items} today={now} legend={CONSULT_LEGEND} renderRow={(item) => <ViewOnlyRow item={item} />} />
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import ScheduleCalendar from '@/components/ScheduleCalendar';
import ExpertConsultRow from '@/components/ExpertConsultRow';
import ConsultationHours from '@/components/ConsultationHours';
import { ScheduleRow } from '@/components/ScheduleItem';
import { useApi } from '@/lib/useApi';
import { LIVE } from '@/lib/live';
import { useNow } from '@/lib/useNow';
import { useConsultMove } from '@/lib/useConsultMove';
import { CONSULT_LEGEND, expertItems } from '@/lib/schedule';
import { PAGE_TITLE } from '@/lib/ui';

// The lawyer's calendar. It shows the consultations booked with this expert's linked directory entry.
// Requests and accepted times show in the same grid and day list and agenda as the student's calendar.
// A lawyer owns no matters and questions have no date so neither is on this page.
// The actions are on each row.
export default function ExpertCalendar() {
  const { data: bookings, error, loading, refetch } = useApi('/bookings/expert', LIVE);
  const now = useNow();
  // The weekly hours. Loaded once and not refreshed in the background, so an unsaved edit is never replaced.
  const hours = useApi('/bookings/availability');
  const windows = hours.data?.windows ?? [];

  const items = useMemo(() => expertItems(bookings ?? [], now), [bookings, now]);
  const { message, onDone } = useConsultMove(refetch, bookings);
  const requests = (bookings ?? []).filter((b) => b.status === 'requested').length;
  const accepted = (bookings ?? []).filter((b) => b.status === 'accepted').length;

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Expert workspace' }]} current="Calendar" />
      {/* Always on the page, so the result of an action is read out when it arrives. */}
      <div role="status" className="sr-only">{message}</div>
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Calendar</h1>
      <p className="mt-2 max-w-reading text-muted-foreground">
        Consultations booked with you. A request is not confirmed until you accept it. An anonymous request says so.
        Questions have no date, so they stay on the Questions page.
      </p>

      {loading && !bookings && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      <ConsultationHours availability={hours.data} error={hours.error} loading={hours.loading} onSaved={hours.refetch} />

      {/* The calendar waits for the list. An empty month while loading would read as no consultations. */}
      {bookings && (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {requests} {requests === 1 ? 'request' : 'requests'} waiting for an answer · {accepted} accepted
          </p>

          {accepted > 0 && (
            // Each accepted consultation has its own call room. The Google Meet link is the fallback and
            // is the same room for every consultation, so its admission setting is the only protection there.
            <Callout title="Admitting people to a call" className="mt-4">
              Each accepted consultation has its own call room, and the person waits until you admit them.
              If a call cannot start here, the shared Google Meet link is used instead. Keep “host must admit”
              switched on there so nobody can join a private consultation by mistake.
            </Callout>
          )}

          {bookings.length === 0 && (
            <p className="mt-4 text-muted-foreground">
              No consultations are booked with you yet. If you expected some, ask an administrator to check
              that your account is linked to your directory entry.
            </p>
          )}

          <div className="mt-6">
            <ScheduleCalendar
              items={items}
              hours={windows}
              today={now}
              legend={CONSULT_LEGEND}
              renderRow={(item) => (item.kind === 'hours'
                ? <ScheduleRow item={item} />
                : <ExpertConsultRow item={item} onDone={onDone} />)}
            />
          </div>
        </>
      )}
    </div>
  );
}

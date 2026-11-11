import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import ErrorNotice from '@/components/ErrorNotice';
import AppointmentGroups from '@/components/AppointmentGroups';
import ExpertConsultRow from '@/components/ExpertConsultRow';
import { useApi } from '@/lib/useApi';
import { LIVE } from '@/lib/live';
import { useNow } from '@/lib/useNow';
import { useScrollToHash } from '@/lib/useScrollToHash';
import { expertItems } from '@/lib/schedule';
import { BUTTON_OUTLINE, CARD, PAGE_TITLE } from '@/lib/ui';

const GROUPS = {
  requested: { id: 'appointments-waiting', title: 'Waiting for your answer', note: 'A request is not confirmed until you accept it.' },
  accepted: { id: 'appointments-upcoming', title: 'Upcoming', note: 'You accepted these times. The person waits until you admit them.' },
};

// The lawyer's consultations in three lists with the requests first.
// Accept and decline and join are on each row. The Calendar shows the same ones by day.
export default function ExpertAppointments() {
  const { data: bookings, error, loading, refetch } = useApi('/bookings/expert', LIVE);
  const now = useNow();
  const items = useMemo(() => expertItems(bookings ?? [], now), [bookings, now]);
  useScrollToHash(Boolean(bookings));

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Expert workspace' }]} current="Appointments" />
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className={PAGE_TITLE}>Appointments</h1>
          <p className="mt-2 max-w-reading text-muted-foreground">
            Consultations booked with you. Answer a request here and join a call when the time comes.
            An anonymous request says so.
          </p>
        </div>
        <Link to="/expert/calendar" className={BUTTON_OUTLINE}>See the calendar</Link>
      </div>

      {loading && !bookings && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      {bookings && bookings.length === 0 && (
        <div className={`mt-6 ${CARD}`}>
          <p className="font-medium">No consultations are booked with you yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If you expected some, ask an administrator to check that your account is linked to your directory entry.
          </p>
        </div>
      )}

      {bookings && bookings.length > 0 && (
        <AppointmentGroups
          items={items}
          order={['requested', 'accepted', 'earlier']}
          groups={GROUPS}
          renderRow={(item) => <ExpertConsultRow item={item} onDone={refetch} />}
        />
      )}
    </div>
  );
}

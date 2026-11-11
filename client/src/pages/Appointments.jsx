import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { LIVE } from '@/lib/live';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity, hasRole } from '@/lib/auth';
import { useNow } from '@/lib/useNow';
import { useScrollToHash } from '@/lib/useScrollToHash';
import { consultItem } from '@/lib/schedule';
import OwnerOnly from '@/components/OwnerOnly';
import Breadcrumb from '@/components/Breadcrumb';
import ErrorNotice from '@/components/ErrorNotice';
import AppointmentGroups from '@/components/AppointmentGroups';
import { BUTTON_OUTLINE, CARD, PAGE_TITLE } from '@/lib/ui';

// The student's consultations in three lists. The Calendar shows the same ones by day.
function AppointmentList() {
  const { data, error, loading } = useApi('/bookings/mine', LIVE);
  const now = useNow();
  const items = useMemo(
    () => (data ?? []).map((b) => consultItem(b, now)).filter(Boolean),
    [data, now],
  );
  useScrollToHash(Boolean(data));

  if (loading && !data) return <p className="mt-6 text-muted-foreground">Loading your appointments…</p>;
  if (error) return <ErrorNotice error={error} className="mt-6" />;

  if (items.length === 0) {
    return (
      <div className={`mt-6 ${CARD}`}>
        <p className="font-medium">You have no appointments yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">Find a lawyer in the Directory and ask for a time.</p>
        <Link to="/directory" className={`${BUTTON_OUTLINE} mt-3`}>Find a lawyer</Link>
      </div>
    );
  }

  return <AppointmentGroups items={items} />;
}

export default function Appointments() {
  const { user } = useAuth();
  // A lawyer or an admin who opens this address goes to their own calendar.
  if (hasRole(user, ['legal_expert'])) return <Navigate to="/expert/calendar" replace />;
  if (hasRole(user, ['admin'])) return <Navigate to="/admin/calendar" replace />;
  return (
    <OwnerOnly signInTitle="Sign in to see your appointments" forbiddenTitle="Appointments are for students and staff">
      {canOwnActivity(user) && (
        <div>
          <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Appointments" />
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className={PAGE_TITLE}>Appointments</h1>
              <p className="mt-3 max-w-reading text-muted-foreground">
                Your consultations with lawyers. Join a call from here when the lawyer has accepted your time.
              </p>
            </div>
            <Link to="/calendar" className={BUTTON_OUTLINE}>See the calendar</Link>
          </div>
          <AppointmentList />
        </div>
      )}
    </OwnerOnly>
  );
}

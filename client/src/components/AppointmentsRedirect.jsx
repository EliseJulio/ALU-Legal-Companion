import { Navigate, useLocation } from 'react-router-dom';

// Redirects to the calendar for the person's role. The query and the hash are kept,
// so a saved link still lands in the same place.
export default function AppointmentsRedirect({ to = '/calendar' }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

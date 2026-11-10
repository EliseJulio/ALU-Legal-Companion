import { Navigate, useLocation, useParams } from 'react-router-dom';

// Sends Where to Go addresses on to the Directory. The query and the hash are kept.
// A matter address opens that matter's answer.
export default function WhereToGoRedirect({ withRoute = false }) {
  const { id } = useParams();
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  if (withRoute && /^\d{1,9}$/.test(id ?? '')) params.set('route', id);
  const query = params.toString();
  return <Navigate replace to={{ pathname: '/directory', search: query ? `?${query}` : '', hash }} />;
}

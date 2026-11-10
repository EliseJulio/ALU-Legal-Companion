import { Link } from 'react-router-dom';
import { useOptionalUser } from '@/lib/AuthContext';
import { homeFor } from '@/lib/nav';
import { RING_ON_CANVAS } from '@/lib/ui';

// "Home / Where to Go / This page". The last part is the page you are on so it is not a link.
// `trail` holds the parts above it as { label, to }. A part with no `to` is plain text.
// It is a list so a screen reader says how many steps there are.
// The slash is only for the eye so it is hidden from a screen reader.
// A "Home" part that points at the front page goes to the signed-in person's own home.
export default function Breadcrumb({ trail = [], current }) {
  const user = useOptionalUser();
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-faint">
      <ol className="flex flex-wrap items-center">
        {trail.map(({ label, to }) => {
          const target = label === 'Home' && to === '/' ? homeFor(user) : to;
          return (
            <li key={label}>
              {target
                ? <Link to={target} className={`inline-flex min-h-touch min-w-touch items-center justify-center rounded-control hover:text-ink ${RING_ON_CANVAS}`}>{label}</Link>
                : label}
              {/* whitespace-pre keeps the spaces. The list is a flex row and would drop them. */}
              <span aria-hidden="true" className="whitespace-pre">{' / '}</span>
            </li>
          );
        })}
        <li aria-current="page" className="text-muted-foreground">{current}</li>
      </ol>
    </nav>
  );
}

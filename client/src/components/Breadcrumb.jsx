import { Link } from 'react-router-dom';
import { RING_ON_CANVAS } from '@/lib/ui';

// "Home / Where to Go / This page". The last part is the page you are on, so it is not a link.
// `trail` holds the parts above it as { label, to }. A part with no `to` is plain text, such as
// the name of a workspace that has no page of its own. It is a list so a screen reader says how
// many steps there are. The slash is only for the eye so it is hidden from a screen reader.
export default function Breadcrumb({ trail = [], current }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center">
        {trail.map(({ label, to }) => (
          <li key={label}>
            {to
              ? <Link to={to} className={`inline-flex min-h-touch items-center underline ${RING_ON_CANVAS}`}>{label}</Link>
              : label}
            {/* whitespace-pre keeps the spaces. The list is a flex row and would drop them. */}
            <span aria-hidden="true" className="whitespace-pre">{' / '}</span>
          </li>
        ))}
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  );
}

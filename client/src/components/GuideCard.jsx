import { Link } from 'react-router-dom';
import VerifiedStamp from '@/components/VerifiedStamp';
import { RING_ON_CANVAS } from '@/lib/ui';

// One published guide as a list card. The saved list uses it too because the server returns the
// same fields for both. It is a list item so the page puts it inside a ul.
export default function GuideCard({ guide }) {
  return (
    <li>
      <Link to={`/guides/${guide.id}`} className={`block rounded border border-border 
        bg-surface p-4 hover:border-primary ${RING_ON_CANVAS}`}>
        <h2 className="font-head text-base font-semibold text-primary">{guide.title}</h2>
        <p className="mt-2 inline-block rounded bg-primary-subtle px-2 py-0.5 font-mono 
        text-xs text-primary">
          {guide.source_law}
        </p>
        <div className="mt-2">
          <VerifiedStamp name={guide.verified_by_name} date={guide.verified_at} />
        </div>
      </Link>
    </li>
  );
}

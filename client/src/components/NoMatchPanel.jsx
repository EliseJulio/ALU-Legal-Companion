import { Link } from 'react-router-dom';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/lib/ui';

// The way forward when no matter fits. It offers the Directory and asking a legal expert.
// The text above it comes from the caller.
export default function NoMatchPanel({ children }) {
  return (
    <div className="mt-4">
      {children}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link to="/directory" className={BUTTON_OUTLINE}>Browse the directory</Link>
        <Link to="/ask" className={BUTTON_PRIMARY}>Ask a legal expert</Link>
      </div>
    </div>
  );
}

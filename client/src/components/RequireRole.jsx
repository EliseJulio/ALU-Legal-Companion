import { Link, useLocation } from 'react-router-dom';
import { signInPath } from '@/lib/url';
import { useAuth } from '@/lib/AuthContext';
import { hasRole } from '@/lib/auth';
import { PANEL, BUTTON_PRIMARY } from '@/lib/ui';

// Guard for the staff pages. There is no redirect. The reader is told why they cannot see the
// page and offered a next step. A check in the browser never signs anyone out. The server is the
// real gate and refuses the same people.
export default function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const here = useLocation();

  if (!user) {
    return (
      <div className={`mt-6 ${PANEL}`}>
        {/* This is the page, so it needs its own heading. */}
        <h1 className="font-head text-2xl text-primary">Sign in to reach this page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is a staff workspace. The guides and the directory are open to everyone without an account.
        </p>
        <Link to={signInPath(here)} className={`${BUTTON_PRIMARY} mt-3`}>Sign in</Link>
      </div>
    );
  }

  if (!hasRole(user, roles)) {
    return (
      <div className={`mt-6 ${PANEL}`}>
        <h1 className="font-head text-2xl text-primary">You do not have permission to open this page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You are signed in as {user.name}. This workspace belongs to a different role. Nothing is
          wrong with your account.
        </p>
        <Link to="/guides" className={`${BUTTON_PRIMARY} mt-3`}>Browse the guides</Link>
      </div>
    );
  }

  return children;
}

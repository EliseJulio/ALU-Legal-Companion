import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import { BUTTON_PRIMARY } from '@/lib/ui';

// Guard for the pages of a person's own matters. Only students and staff can have them.
// There is no redirect. The reader is told why they cannot see the page and offered a next step.
// A check in the browser never signs anyone out. The server is the real gate.
export default function OwnerOnly({ children }) {
  const { user } = useAuth();
  if (canOwnActivity(user)) return children;
  return (
    <div className="mt-6 rounded border border-border bg-surface p-4">
      <h1 className="font-head text-2xl text-primary">
        {user ? 'Matter tracking is for students and staff' : 'Sign in to track a matter'}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {user
          ? `You are signed in as ${user.name}. Tracked matters belong to the student or staff member who opened them.`
          : 'Your matters are private to you so they need an account. Where to go and the directory work without one.'}
      </p>
      <Link to={user ? '/where-to-go' : '/login'} className={`${BUTTON_PRIMARY} mt-3`}>
        {user ? 'Where do I take this?' : 'Sign in'}
      </Link>
    </div>
  );
}

import { Link, NavLink } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity, hasRole } from '@/lib/auth';
// The logo is imported and not written as a path. A typo is then a build error and not a
// broken image. Every file is served from this website. The app makes no request to any other site.
import aluLogo from '@/assets/brand/alu-logo.png';

// The menu is chosen by role. A person is only offered a link that their own routes answer.
// A link to a page that refuses you looks like a destination and is a dead end.
//
// Rule 5 says the SOS link must be easy to reach on every page. It is in the top bar, which
// comes before this menu, so every link here is further away from the keyboard than SOS.
// Links are only ever added after the existing ones. The tests walk this row by accessible
// name to check the order.
const PUBLIC_LINKS = [
  { to: '/where-to-go', label: 'Where to go' },
  { to: '/directory', label: 'Directory' },
  { to: '/guides', label: 'Guides' },
  { to: '/ask', label: 'Ask a question' },
];

// Students and staff only. These pages use routes that refuse every other role.
const OWNER_LINKS = [
  { to: '/matters', label: 'My matters' },
  { to: '/saved', label: 'Saved' },
  { to: '/my-activity', label: 'My activity' },
];

// `end` makes /expert and /admin current only on their own page. Without it they stay current
// beside every page below them and a screen reader announces two current pages.
const EXPERT_LINKS = [
  { to: '/expert', label: 'Review queue', end: true },
  { to: '/expert/questions', label: 'Questions' },
  { to: '/expert/bookings', label: 'Appointments' },
  { to: '/expert/directory', label: 'Directory review' },
  { to: '/expert/matters', label: 'Shared matters' },
];

// The labels differ from the public ones on purpose. A screen reader user chooses from a list
// of links by name. Two links called "Directory" that go to different places is a guess.
const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/guides', label: 'Manage guides' },
  { to: '/admin/providers', label: 'Manage directory' },
  { to: '/admin/routes', label: 'Manage routes' },
  { to: '/admin/users', label: 'People' },
  { to: '/admin/invites', label: 'Invites' },
  { to: '/admin/contacts', label: 'Crisis contacts' },
];

// Every signed-in role has a name and a password to manage. It is in this menu and not in the
// top bar because the top bar comes before the SOS link.
const ACCOUNT_LINK = { to: '/settings', label: 'Account' };

// Built once. Each role always gets the same array so nothing re-renders for no reason.
const OWNER_NAV = [...PUBLIC_LINKS, ...OWNER_LINKS, ACCOUNT_LINK];
const EXPERT_NAV = [...PUBLIC_LINKS, ...EXPERT_LINKS, ACCOUNT_LINK];
const ADMIN_NAV = [...PUBLIC_LINKS, ...ADMIN_LINKS, ACCOUNT_LINK];

function navFor(user) {
  if (canOwnActivity(user)) return OWNER_NAV;
  if (hasRole(user, ['legal_expert'])) return EXPERT_NAV;
  if (hasRole(user, ['admin'])) return ADMIN_NAV;
  return PUBLIC_LINKS;
}

const RING_ON_PRIMARY = 'focus-visible:ring-2 focus-visible:ring-surface focus-visible:ring-offset-2 focus-visible:ring-offset-primary';

export default function Header() {
  const { user, signOut } = useAuth();
  const links = navFor(user);

  return (
    // z-40 and not z-50. The skip link is z-50 and comes first in the page. It must stay on
    // top of this header when it has focus.
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className={`flex min-h-touch items-center gap-3 leading-tight ${RING_ON_PRIMARY}`}>
          {/* The logo is decoration. The two lines beside it already say the name. An alt text
              would make the link read the name twice. */}
          <img src={aluLogo} alt="" aria-hidden="true" className="h-8 w-auto shrink-0" />
          <span>
            <span className="block font-head text-base font-semibold">ALU Legal Companion</span>
            <span className="block text-xs tracking-wide text-primary-subtle">AFRICAN LEADERSHIP UNIVERSITY</span>
          </span>
        </Link>

        {/* The account control sits beside the SOS link and not around it so nothing here can
            move or hide the crisis path. */}
        {user ? (
          <div className="ml-auto mr-3 flex min-w-0 items-center gap-2 text-xs">
            {/* A long name is cut short. It must never push the SOS link off the row. */}
            <span className="truncate font-semibold">{user.name}</span>
            <button
              type="button"
              onClick={signOut}
              className={`min-h-touch whitespace-nowrap text-primary-subtle underline ${RING_ON_PRIMARY}`}
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className={`ml-auto mr-3 flex min-h-touch min-w-touch items-center justify-center whitespace-nowrap text-xs font-semibold underline ${RING_ON_PRIMARY}`}
          >
            Sign in
          </Link>
        )}

        {/* A white chip. Red text needs a white ground to reach 4.5:1. */}
        <Link
          to="/emergency"
          className={`flex min-h-touch items-center gap-1.5 rounded bg-surface px-3 py-1.5 text-xs font-bold text-warning ${RING_ON_PRIMARY}`}
        >
          <TriangleAlert aria-hidden="true" className="h-4 w-4" />
          SOS
        </Link>
      </div>

      {/* The menu wraps onto more lines. A scrolling row would push some links past the edge
          of a phone with nothing to say they were there. */}
      <nav aria-label="Main" className="bg-primary-strong">
        <ul className="mx-auto flex max-w-5xl flex-wrap gap-x-4 px-4 text-xs">
          {links.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-touch min-w-touch items-center justify-center whitespace-nowrap focus-visible:ring-2 focus-visible:ring-surface focus-visible:ring-offset-2 focus-visible:ring-offset-primary-strong ${isActive ? 'border-b-2 border-surface font-bold text-primary-foreground' : 'text-primary-subtle'}`
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

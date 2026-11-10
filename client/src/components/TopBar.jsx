import { Link, NavLink } from 'react-router-dom';
import AccountMenu from '@/components/AccountMenu';
import Bell from '@/components/Bell';
import Brand from '@/components/Brand';
import EmergencyLink from '@/components/EmergencyLink';
import Icon from '@/components/Icon';
import SearchField from '@/components/SearchField';
import { ThemeButton } from '@/components/ThemeControls';
import { PUBLIC_LINKS } from '@/lib/nav';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, RING_ON_CANVAS } from '@/lib/ui';

// The top bar. The emergency numbers come straight after the skip link on a wide screen.
// On a phone they come right after the logo.
// A visitor on a wide screen also gets the public pages in a row under the bar. There is no menu.
// `className` places the bar in the wide layout's grid.
// `onSignOut` is the sign out the account menu offers.
export default function TopBar({ user, phone = false, className = '', onSignOut = () => {} }) {
  if (phone) return <PhoneBar user={user} className={className} />;
  // A signed-in person's bar has no rule and no tint. It sits on the page.
  // The visual order is set with CSS `order`: search then the theme button (pushed right) then
  // the emergency numbers then the bell then the avatar.
  // The DOM order is unchanged so Emergency is still first for the keyboard.
  return (
    <header className={`${user ? '' : 'border-b border-border bg-canvas'} ${className}`}>
      <div className={`flex flex-wrap items-center gap-3 ${user ? 'px-2.5 pt-1.5' : 'px-5 py-3 md:px-8'}`}>
        {!user && <Brand />}
        {/* The emergency numbers sit in the same place for a visitor and for a signed-in person:
            after the theme button, before the account controls. */}
        <EmergencyLink roomy className="order-3" />
        {/* The box is 44 px high. Its text box keeps the 44 px touch height. */}
        <SearchField className={user ? 'order-1 h-11 w-80 max-w-full shrink-0' : 'order-1'} />
        <ThemeButton className="order-2 ml-auto" />
        {user ? (
          <div className="order-4 flex items-center gap-3">
            <Bell user={user} />
            <AccountMenu user={user} onSignOut={onSignOut} />
          </div>
        ) : (
          <>
            <Link id="sign-in-link" to="/login" className={`${BUTTON_OUTLINE} order-4`}>Sign in</Link>
            <Link to="/register" className={`${BUTTON_PRIMARY} order-4`}>Create account</Link>
          </>
        )}
      </div>
      {!user && (
        <nav aria-label="Main" className="px-5 pb-2 md:px-8">
          <ul className="flex flex-wrap gap-1">
            {PUBLIC_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => `flex min-h-touch items-center rounded-control px-3 text-sm ${RING_ON_CANVAS} ${isActive ? 'bg-primary-subtle font-semibold text-primary-text' : 'text-muted-foreground hover:text-ink'}`}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

// The slim bar of a phone and a tablet. It holds the logo and the emergency numbers and search and the bell.
function PhoneBar({ user, className }) {
  return (
    <header className={`border-b border-border bg-canvas ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2">
        <Brand compact />
        <EmergencyLink short className="ml-auto max-w-[8.5rem] text-sm" />
        <Link
          to="/search"
          aria-label="Search the site"
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-soft text-muted-foreground hover:text-ink ${RING_ON_CANVAS}`}
        >
          <Icon name="search" />
        </Link>
        {user && <Bell user={user} placement="phone" />}
      </div>
    </header>
  );
}

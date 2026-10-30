import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ACCOUNT_LINK, navGroups } from '@/lib/nav';
import { BUTTON_ON_CHROME, RING_ON_CHROME } from '@/lib/ui';
import Brand from '@/components/Brand';
import EmergencyLink from '@/components/EmergencyLink';
import Icon from '@/components/Icon';
import ThemeSwitch from '@/components/ThemeSwitch';

const ROW = `flex min-h-touch w-full items-center gap-3 rounded border-l-4 px-3 text-left text-sm ${RING_ON_CHROME}`;
const IDLE = 'border-transparent text-on-chrome hover:bg-chrome-raised';
const TITLE = 'px-3 text-xs font-semibold uppercase tracking-wide text-on-chrome';
const CONTROL = `flex min-h-touch items-center gap-1 rounded px-2 text-xs font-semibold text-on-chrome hover:bg-chrome-raised ${RING_ON_CHROME}`;
// In the narrow bar every item is an icon with a short word under it. It is the same on a
// keyboard, a touch screen and a mouse. Nothing depends on a hover tip.
const NARROW_ITEM = 'lg:flex-col lg:justify-center lg:gap-0.5 lg:px-1 lg:py-1.5 lg:text-center lg:text-[11px] lg:leading-tight';
const NARROW_ICON = 'lg:text-2xl';
// A screen reader hears what changed. The button that was pressed keeps focus, so a changed name
// alone would not be read out.
const NOTES = { expanded: 'Menu widened', collapsed: 'Menu narrowed', hidden: 'Menu hidden' };
const groupId = (title) => `nav-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;

// The navigation of every page. From the lg width up it is a bar down the left side. It has
// three modes: open, narrow (an icon with a short word) and hidden (a slim bar on top, like a
// phone). Below lg it is always the slim bar with a Menu button that opens the same list under it.
// The emergency link comes right after the logo in every mode. It is never inside the list.
export default function SideNav({ mode = 'expanded', onMode = () => {}, onShow = () => {} }) {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const menuButton = useRef(null);
  const narrowButton = useRef(null);
  const showButton = useRef(null);
  const signInLink = useRef(null);
  const list = useRef(null);
  const hidden = mode === 'hidden';
  const narrow = mode === 'collapsed';

  // A new page closes the small-screen list, whichever link or button led there.
  const [openedOn, setOpenedOn] = useState(pathname);
  if (pathname !== openedOn) {
    setOpenedOn(pathname);
    if (open) setOpen(false);
  }

  // The current page has a bar on its left edge as well as a lighter fill. It never relies on colour.
  const rowClass = ({ isActive }) =>
    `${ROW} ${narrow ? NARROW_ITEM : ''} ${isActive ? 'border-chrome-foreground bg-chrome-raised font-semibold text-chrome-foreground' : IDLE}`;
  const iconClass = narrow ? NARROW_ICON : '';
  const titleClass = `${TITLE} ${narrow ? 'lg:sr-only' : ''}`;

  // When the list opens on a small screen the first link gets focus. Escape closes it. Focus goes
  // back to the Menu button only when that button is on the screen.
  useEffect(() => {
    if (!open) return undefined;
    list.current?.querySelector('a')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        const button = menuButton.current;
        if (button && getComputedStyle(button).display !== 'none') button.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Hiding the menu moves focus to Show menu. Showing it moves focus back to a menu control. It
  // only runs when the mode really changed, so a page load takes no focus.
  const wasHidden = useRef(hidden);
  useEffect(() => {
    if (wasHidden.current === hidden) return;
    wasHidden.current = hidden;
    (hidden ? showButton : narrowButton).current?.focus();
  }, [hidden]);

  // Signing out replaces the Sign out button with a Sign in link. The button is gone, so focus goes
  // to the link. Otherwise it would fall to the page body.
  const wasSignedIn = useRef(Boolean(user));
  useEffect(() => {
    const signedIn = Boolean(user);
    if (wasSignedIn.current && !signedIn) signInLink.current?.focus();
    wasSignedIn.current = signedIn;
  }, [user]);

  // Choosing a link closes the small-screen list. The link then leaves the screen, so focus goes
  // to the Menu button and not to the page body.
  const close = () => {
    if (!open) return;
    setOpen(false);
    menuButton.current?.focus();
  };
  // The words go in the address, so the results page can be reloaded and shared. URLSearchParams
  // writes a space and an ampersand safely.
  const searchNow = (event) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    // The state asks the results page to take focus on its heading. The menu keeps its box empty.
    navigate(text ? `/search?${new URLSearchParams({ q: text })}` : '/search', { state: { focusResults: true } });
    event.currentTarget.reset();
    close();
  };
  const change = (next) => {
    setNote(NOTES[next]);
    onMode(next);
  };
  const showAgain = () => {
    setNote('Menu shown');
    onShow();
  };

  const frame = hidden
    ? ''
    : `lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:flex-col lg:overflow-y-auto ${narrow ? 'lg:w-rail' : 'lg:w-sidebar'}`;
  const top = hidden
    ? 'lg:px-12'
    : narrow
      ? 'lg:flex-col lg:items-center lg:gap-3 lg:px-1 lg:py-4'
      : 'lg:flex-col lg:items-start lg:gap-4 lg:px-6 lg:py-6';
  const actions = hidden ? '' : narrow ? 'lg:ml-0 lg:w-full lg:flex-col lg:items-center' : 'lg:ml-0 lg:w-full';

  return (
    <header className={`bg-chrome text-chrome-foreground ${frame}`}>
      <p role="status" className="sr-only">{note}</p>
      <div className={`flex items-center gap-x-2 gap-y-1 px-4 py-2 max-[359px]:flex-wrap sm:gap-x-3 sm:px-5 sm:flex-wrap ${top}`}>
        <Brand compact={narrow} bar={hidden} />
        <div className={`ml-auto flex shrink-0 items-center gap-1 sm:gap-2 ${actions}`}>
          <EmergencyLink compact={narrow} className={narrow || hidden ? '' : 'lg:w-full'} />
          <button
            ref={menuButton}
            type="button"
            aria-expanded={open}
            aria-controls="side-nav"
            onClick={() => setOpen((value) => !value)}
            className={`flex min-h-touch items-center gap-1 rounded px-2 text-sm font-semibold lg:hidden ${RING_ON_CHROME}`}
          >
            <Icon name={open ? 'close' : 'menu'} />
            Menu
          </button>
          {hidden && (
            <Link to="/search" aria-label="Search the site" className={`hidden min-h-touch items-center gap-1 rounded px-2 text-sm font-semibold lg:flex ${RING_ON_CHROME}`}>
              <Icon name="search" />
              <span>Search</span>
            </Link>
          )}
          {hidden && (
            <button
              ref={showButton}
              type="button"
              onClick={showAgain}
              className={`hidden min-h-touch items-center gap-1 rounded px-2 text-sm font-semibold lg:flex ${RING_ON_CHROME}`}
            >
              <Icon name="left_panel_open" />
              <span>Show{' '}<span className="sr-only">menu</span></span>
            </button>
          )}
        </div>
        {!hidden && (
          <div className={`hidden gap-1 lg:flex ${narrow ? 'w-full flex-col items-center' : 'w-full justify-between'}`}>
            <button
              ref={narrowButton}
              type="button"
              onClick={() => change(narrow ? 'expanded' : 'collapsed')}
              className={`${CONTROL} ${narrow ? 'lg:min-w-touch lg:flex-col lg:justify-center lg:gap-0 lg:text-[11px]' : ''}`}
            >
              <Icon name={narrow ? 'chevron_right' : 'chevron_left'} className={iconClass} />
              <span>{narrow ? 'Widen' : 'Narrow'}{' '}<span className="sr-only">menu</span></span>
            </button>
            <button
              type="button"
              onClick={() => change('hidden')}
              className={`${CONTROL} ${narrow ? 'lg:min-w-touch lg:flex-col lg:justify-center lg:gap-0 lg:text-[11px]' : ''}`}
            >
              <Icon name="left_panel_close" className={iconClass} />
              <span>Hide{' '}<span className="sr-only">menu</span></span>
            </button>
          </div>
        )}
        {/* The narrow bar has no room for a box. A Search link leads to the page that has one. */}
        {narrow && (
          <div className="hidden w-full lg:flex lg:justify-center">
            <Link to="/search" aria-label="Search the site" className={`${CONTROL} lg:min-w-touch lg:flex-col lg:justify-center lg:gap-0 lg:text-[11px]`}>
              <Icon name="search" className={iconClass} />
              <span>Search</span>
            </Link>
          </div>
        )}
      </div>

      {/* The search box. It is its own landmark and sits outside the list of pages. */}
      <form
        role="search"
        aria-label="Site search"
        onSubmit={searchNow}
        className={`${open ? 'block' : 'hidden'} ${hidden || narrow ? 'lg:hidden' : 'lg:block'} px-5 pb-4 lg:px-6`}
      >
        <label htmlFor="menu-search" className="sr-only">Search the site</label>
        <div className="flex min-h-touch items-center rounded border border-on-chrome bg-chrome-raised pl-3 focus-within:ring-2 focus-within:ring-chrome-foreground">
          <input
            id="menu-search"
            name="q"
            type="search"
            maxLength={100}
            placeholder="Search the site"
            className="min-h-touch w-full min-w-0 bg-transparent text-sm text-chrome-foreground placeholder:text-on-chrome focus:outline-none"
          />
          <button type="submit" className={`grid min-h-touch min-w-touch shrink-0 place-items-center rounded ${RING_ON_CHROME}`}>
            <Icon name="search" />
            <span className="sr-only">Search the site</span>
          </button>
        </div>
      </form>

      <nav
        id="side-nav"
        ref={list}
        aria-label="Main"
        className={`${open ? 'block' : 'hidden'} ${hidden ? 'lg:hidden' : 'lg:block lg:flex-1'} px-5 pb-5 ${narrow ? 'lg:px-1' : 'lg:px-6'} lg:pb-6`}
      >
        {navGroups(user).map((group) => (
          <div key={group.title} className="mt-5 first:mt-0">
            <p id={groupId(group.title)} className={titleClass}>{group.title}</p>
            <ul aria-labelledby={groupId(group.title)} className="mt-2 flex flex-col gap-1">
              {group.links.map(({ to, label, icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} onClick={close} className={rowClass}>
                    <Icon name={icon} className={iconClass} />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="mt-5">
          <p id="nav-account" className={titleClass}>Account</p>
          <ul aria-labelledby="nav-account" className="mt-2 flex flex-col gap-1">
            {user ? (
              <>
                {/* The name shows on the open menu. The narrow bar has no room for it. */}
                <li className={`flex min-h-touch items-center gap-3 px-3 text-sm text-chrome-foreground ${narrow ? 'lg:hidden' : ''}`}>
                  <Icon name="person" />
                  <span className="min-w-0 truncate">{user.name}</span>
                </li>
                <li>
                  <NavLink to={ACCOUNT_LINK.to} onClick={close} className={rowClass}>
                    <Icon name={ACCOUNT_LINK.icon} className={iconClass} />
                    {ACCOUNT_LINK.label}
                  </NavLink>
                </li>
                <li>
                  <button type="button" onClick={signOut} className={`${ROW} ${IDLE} ${narrow ? NARROW_ITEM : ''}`}>
                    <Icon name="logout" className={iconClass} />
                    Sign out
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link ref={signInLink} to="/login" onClick={close} className={`${BUTTON_ON_CHROME} w-full gap-2 ${narrow ? `${NARROW_ITEM} lg:min-h-touch` : ''}`}>
                  <Icon name="login" className={iconClass} />
                  Sign in
                </Link>
              </li>
            )}
          </ul>
        </div>

        {/* The theme switch is on the open menu. Widen the menu to reach it. */}
        <div className={`mt-5 ${narrow ? 'lg:hidden' : ''}`}>
          <ThemeSwitch />
        </div>
      </nav>
    </header>
  );
}

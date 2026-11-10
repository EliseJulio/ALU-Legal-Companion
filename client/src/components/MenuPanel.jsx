import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import Brand from '@/components/Brand';
import Icon from '@/components/Icon';
import { ThemeCycleButton } from '@/components/ThemeControls';
import { navGroups } from '@/lib/nav';
import { themeName, useTheme } from '@/lib/theme';
import { RING_ON_CHROME } from '@/lib/ui';

// The one sidebar of a wide screen. Open it is 264 px wide.
// It holds the logo and the person's name and role and the pages in groups.
// The theme and the narrow button are at the foot.
// Narrowed it is 76 px wide with the logo and one icon per page.
// The same element stays on screen in both states so the narrow button keeps focus.
// Every icon keeps its name for a screen reader. A label shows beside it on hover and on keyboard focus.
// The label is drawn outside the bar (a portal) because the bar clips anything that sticks out.

// The rows and buttons of the side bar have small corners (rounded-control).
const OPEN_LINK = `flex min-h-touch items-center gap-3 rounded-control px-3 text-sm ${RING_ON_CHROME}`;
const NARROW_LINK = `grid h-11 w-11 mx-auto place-items-center rounded-soft ${RING_ON_CHROME}`;
const SIDE_CONTROL = `flex min-h-touch w-full items-center gap-3 rounded-control px-3 text-sm text-on-chrome hover:bg-chrome-raised hover:text-chrome-foreground ${RING_ON_CHROME}`;
const NARROW_CONTROL = `mx-auto grid h-11 w-11 place-items-center rounded-soft text-on-chrome hover:bg-chrome-raised hover:text-chrome-foreground ${RING_ON_CHROME}`;

// The open page is a soft grey row with a bold label and the normal ink icon. Narrowed it is a soft
// blue tint with a blue icon. aria-current marks the page for a screen reader, so the tint is not the only mark.
function linkClass(narrow, isActive) {
  if (narrow) {
    return `${NARROW_LINK} ${isActive ? 'bg-primary-subtle text-primary-text' : 'text-on-chrome hover:bg-chrome-raised hover:text-chrome-foreground'}`;
  }
  return `${OPEN_LINK} ${isActive
    ? 'bg-chrome-raised font-semibold text-chrome-foreground'
    : 'text-on-chrome hover:bg-chrome-raised hover:text-chrome-foreground'}`;
}

// The label beside a narrow icon. One label shows at a time.
// It waits a moment on a mouse. It shows at once on keyboard focus. Escape or scrolling takes it away.
const TIP_ID = 'menu-tip';
function useTip(active) {
  const [tip, setTip] = useState(null);
  const timer = useRef(null);
  const pressed = useRef(false);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setTip(null);
  }, []);
  const show = useCallback((el, label, now) => {
    clearTimeout(timer.current);
    const place = () => {
      const box = el.getBoundingClientRect();
      setTip({ label, left: box.right + 8, top: box.top + box.height / 2 });
    };
    if (now) place();
    else timer.current = setTimeout(place, 250);
  }, []);
  useEffect(() => {
    if (!tip) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tip, hide]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // What goes on an icon: the events and the link to the label while it is shown.
  const props = (label) => (active ? {
    onMouseEnter: (e) => show(e.currentTarget, label, false),
    onMouseLeave: hide,
    // A press with the mouse also focuses the icon. That is not a keyboard visit, so no label.
    onMouseDown: () => { pressed.current = true; },
    onFocus: (e) => {
      if (pressed.current) pressed.current = false;
      else show(e.currentTarget, label, true);
    },
    onBlur: hide,
    onClick: hide,
    'aria-describedby': tip?.label === label ? TIP_ID : undefined,
  } : {});
  const label = tip && active && createPortal(
    <div
      id={TIP_ID}
      role="tooltip"
      style={{ left: tip.left, top: tip.top }}
      className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-control bg-inverse px-2.5 py-1.5 text-sm font-medium text-inverse-foreground"
    >
      {tip.label}
    </div>,
    document.body,
  );
  return { props, label, hide };
}

export function MenuPanel({ user, narrow = false, onToggle, onSignOut, className = '' }) {
  const groups = navGroups(user);
  const tips = useTip(narrow);
  const theme = useTheme();
  return (
    // The card never scrolls as a whole. Only the page links scroll.
    // The foot with the theme and Narrow menu and Sign out stays on screen at any height.
    <aside
      aria-label="Menu"
      className={`sticky flex shrink-0 ${narrow ? 'top-2 h-[calc(100vh-1rem)]' : 'top-3 h-[calc(100vh-1.5rem)]'} flex-col overflow-hidden no-scrollbar rounded-card border border-border bg-chrome text-chrome-foreground ${narrow ? 'w-rail items-center px-1.5 py-1.5' : 'w-sidebar px-3 py-4 short:py-2'} ${className}`}
    >
      <div className={`shrink-0 ${narrow ? 'mb-1 flex w-full justify-center pb-2' : 'mb-1.5 px-1.5 pb-3.5 short:mb-0 short:pb-1.5'}`}>
        <Brand tone="chrome" compact={narrow} stacked />
      </div>
      {user && (
        // Only the full name, under the divider. It wraps; it is never cut short. In the narrow
        // sidebar it stays for a screen reader only: the space is for the icons.
        <p className={narrow ? 'sr-only' : 'shrink-0 break-words px-1.5 pt-3 text-sm font-semibold leading-[1.6] text-chrome-foreground short:pt-1 short:leading-5'}>
          {user.name}
        </p>
      )}

      <nav
        aria-label="Main"
        onScroll={tips.hide}
        className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar ${narrow ? 'mt-1 flex w-full flex-col items-center' : 'flex flex-col'}`}
      >
        {groups.map((group, index) => {
          const id = `menu-${group.title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
          return (
            <Fragment key={group.title}>
              <div className={narrow ? `flex w-full flex-col items-center${index > 0 ? ' mt-3' : ''}` : undefined}>
                <p id={id} className={narrow ? 'sr-only' : 'mx-3 mb-1 mt-[18px] text-xs leading-[19px] text-faint short:mb-0 short:mt-1 short:leading-4'}>
                  {group.title}
                </p>
                <ul aria-labelledby={id} className={narrow ? 'flex flex-col items-center gap-1' : 'flex flex-col gap-0.5 short:gap-0'}>
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        end={link.end}
                        aria-label={narrow ? link.label : undefined}
                        {...tips.props(link.label)}
                        className={({ isActive }) => linkClass(narrow, isActive)}
                      >
                        {() => (
                          <>
                            <Icon name={link.icon} />
                            {!narrow && link.label}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            </Fragment>
          );
        })}
      </nav>

      <div className={`shrink-0 ${narrow ? 'mt-auto flex w-full flex-col items-center pt-1' : 'mt-auto flex flex-col gap-2 pt-2.5 short:gap-0 short:pt-1'}`}>
        {!narrow && (
          // One button: the name of the mode sits beside its icon. A press moves to the next mode.
          <div className="flex items-center justify-between gap-2 px-3">
            <span className="text-xs text-faint">Theme</span>
            <ThemeCycleButton tone="chrome" showName />
          </div>
        )}
        {narrow && (
          // The narrow menu has no room for words, so the icon alone; its tooltip says the mode.
          <ThemeCycleButton
            tone="chrome"
            className="mx-auto"
            {...tips.props(`Theme: ${themeName(theme)}`)}
          />
        )}
        <button
          id="narrow-menu"
          type="button"
          {...tips.props('Widen menu')}
          onClick={(e) => { tips.hide(); onToggle(e); }}
          aria-label={narrow ? 'Widen menu' : undefined}
          className={narrow ? NARROW_CONTROL : SIDE_CONTROL}
        >
          <Icon name={narrow ? 'chevron_right' : 'chevron_left'} />
          {!narrow && 'Narrow menu'}
        </button>
        {user && (
          <button
            type="button"
            onClick={onSignOut}
            aria-label={narrow ? 'Sign out' : undefined}
            {...tips.props('Sign out')}
            className={narrow ? NARROW_CONTROL : SIDE_CONTROL}
          >
            <Icon name="logout" />
            {!narrow && 'Sign out'}
          </button>
        )}
      </div>
      {tips.label}
    </aside>
  );
}

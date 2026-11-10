import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '@/components/Icon';
import { ThemeCycleButton } from '@/components/ThemeControls';
import { roleName } from '@/lib/nav';
import { RING_ON_CANVAS } from '@/lib/ui';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The More sheet on a phone. It holds every page for this person in the same groups as the menu.
// It is a dialog so Tab stays inside it while it is open.
// Escape and a tap on the dimmed page close it. The layout makes the page behind it inert.
// `onClose` gives focus back to the More button. `onSignOut` is for the sign out button.
export default function MoreSheet({ open, groups, user, onClose, onSignOut }) {
  const box = useRef(null);
  const closeButton = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeButton.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !box.current) return;
      // Tab wraps from the last item to the first and back.
      // A focus outside the sheet comes in at the nearest end.
      const items = [...box.current.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = box.current.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-canvas opacity-60" />
      <section
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-title"
        className="relative max-h-[86vh] overflow-y-auto rounded-t-card border border-border bg-surface px-4 pt-3"
      >
        <div className="flex items-center justify-between gap-3 pb-2">
          <h2 id="more-title" className="font-head text-base font-semibold">All pages</h2>
          <button
            ref={closeButton}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`grid h-11 w-11 place-items-center rounded-control text-muted-foreground hover:text-ink ${RING_ON_CANVAS}`}
          >
            <Icon name="close" />
          </button>
        </div>

        {user && (
          <p className="px-1 pb-1 text-sm text-muted-foreground">
            <span className="font-semibold text-ink">{user.name}</span>
            {' · '}
            {roleName(user)}
          </p>
        )}

        {groups.map((group) => {
          const id = `more-${group.title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
          return (
            <div key={group.title}>
              <p id={id} className="mt-3.5 px-1 pb-1 text-xs text-faint">{group.title}</p>
              <ul aria-labelledby={id} className="mt-1 flex flex-col">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      end={link.end}
                      onClick={onClose}
                      className={({ isActive }) => `flex min-h-[48px] items-center gap-3 rounded-control px-3 text-sm ${RING_ON_CANVAS} ${isActive ? 'bg-chrome-raised font-semibold text-ink' : 'text-ink hover:bg-chrome-raised'}`}
                    >
                      <Icon name={link.icon} />
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {/* The theme and sign out stay at the foot of the sheet while the pages scroll. */}
        <div className="sticky bottom-0 -mx-4 mt-3 bg-surface px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-2">
          <div className="flex items-center justify-between gap-3 pb-1">
            <span className="px-1 text-sm text-muted-foreground">Theme</span>
            <ThemeCycleButton tone="surface" showName />
          </div>
          {user && (
            <button
              type="button"
              onClick={onSignOut}
              className={`flex min-h-[48px] w-full items-center gap-3 rounded-control px-3 text-sm text-ink hover:bg-chrome-raised ${RING_ON_CANVAS}`}
            >
              <Icon name="logout" />
              Sign out
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

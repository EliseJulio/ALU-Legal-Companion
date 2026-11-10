import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/Icon';
import { ACCOUNT_LINK, roleName } from '@/lib/nav';
import { announcePopover, closeWhenOtherOpens } from '@/lib/popover';
import { RING_ON_CANVAS } from '@/lib/ui';

const ITEM = `flex min-h-touch w-full items-center gap-3 rounded-control px-3 text-left text-sm text-ink hover:bg-chrome-raised ${RING_ON_CANVAS}`;

// The first letters of the first two words of a name, for the round avatar.
function initialsOf(name = '') {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase());
  return letters.join('') || '?';
}

// The avatar in the wide top bar. It opens a small menu with the person's name and role, the Account
// page and Sign out. Sign out is the same action the sidebar uses. Escape, a click outside or a
// choice closes it. Only one top bar panel is open at a time (see lib/popover.js).
export default function AccountMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const button = useRef(null);
  const menu = useRef(null);

  // A bell panel that opens closes this menu.
  useEffect(() => closeWhenOtherOpens('account', () => setOpen(false)), []);

  // Opening moves focus to the first item. Escape closes and returns focus to the avatar. A click
  // outside closes it and leaves focus where the person put it.
  useEffect(() => {
    if (!open) return undefined;
    menu.current?.querySelector('[role="menuitem"]')?.focus();
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event) => {
      if (!wrap.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  if (!user) return null;

  function toggle() {
    if (!open) announcePopover('account');
    setOpen((value) => !value);
  }

  // Arrow keys move between the two items and wrap at either end.
  function moveBetween(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...menu.current.querySelectorAll('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(at + step + items.length) % items.length].focus();
  }

// The page changes after Account is chosen. Focus goes back to the avatar.
  function chooseAccount() {
    setOpen(false);
    button.current?.focus();
  }

  function signOutNow() {
    setOpen(false);
    onSignOut();
  }

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        // The visible text is the initials, so the accessible name starts with them.
        aria-label={`${initialsOf(user.name)}, ${user.name}, account menu`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'account-panel' : undefined}
        onClick={toggle}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ${RING_ON_CANVAS}`}
      >
        <span aria-hidden="true">{initialsOf(user.name)}</span>
      </button>

      {open && (
        <div
          id="account-panel"
          className="absolute right-0 top-full z-40 mt-2 w-[min(16.25rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-2 shadow-lg"
        >
          <div className="px-3 pb-3 pt-2">
            <p className="font-semibold text-ink">{user.name}</p>
            <p className="text-sm text-muted-foreground">{roleName(user)}</p>
          </div>
          <div ref={menu} role="menu" aria-label="Account actions" onKeyDown={moveBetween} className="mt-1 flex flex-col">
            <Link role="menuitem" to={ACCOUNT_LINK.to} onClick={chooseAccount} className={ITEM}>
              <Icon name={ACCOUNT_LINK.icon} />
              Account
            </Link>
            <button role="menuitem" type="button" onClick={signOutNow} className={ITEM}>
              <Icon name="logout" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

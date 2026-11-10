import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/Icon';
import { announcePopover, closeWhenOtherOpens } from '@/lib/popover';
import { useNotifications } from '@/lib/useNotifications';
import { BUTTON_OUTLINE, RING_ON_CANVAS } from '@/lib/ui';

// The bell. A screen reader hears how many items are unread. Everyone else sees the count.
// Opening it loads the list again. Opening an item marks it read and goes to its page.
// A visitor has no bell.
export default function Bell({ user, placement = 'desktop' }) {
  const notes = useNotifications(user);
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const button = useRef(null);
  const panel = useRef(null);

  // Escape closes the panel and gives focus back to the bell. A click outside closes it and leaves
  // focus where the person put it. Opening moves focus into the panel.
  // Only one top bar panel is open at a time. The account menu closes this one when it opens.
  useEffect(() => closeWhenOtherOpens('bell', () => setOpen(false)), []);

  useEffect(() => {
    if (!open) return undefined;
    panel.current?.focus();
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

  const label = notes.unread > 0 ? `Notifications, ${notes.unread} unread` : 'Notifications';

  function toggle() {
    if (!open) {
      notes.reload();
      announcePopover('bell');
    }
    setOpen((value) => !value);
  }

  function opened(id) {
    notes.markRead(id);
    setOpen(false);
    button.current?.focus();
  }

  const phone = placement === 'phone';
  const panelPlace = phone
    ? 'fixed inset-x-4 top-16 max-h-[70vh]'
    : 'absolute right-0 top-full mt-2 max-h-[70vh] w-[min(24rem,calc(100vw-2rem))]';

  return (
    <div ref={wrap} className={phone ? '' : 'relative'}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? 'notifications' : undefined}
        onClick={toggle}
        className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-soft text-muted-foreground hover:text-ink ${RING_ON_CANVAS}`}
      >
        <Icon name="bell" />
        {notes.unread > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-inverse px-1 text-center text-xs font-semibold leading-5 text-inverse-foreground">
            {notes.unread}
          </span>
        )}
      </button>

      {open && (
        <section
          id="notifications"
          ref={panel}
          role="dialog"
          aria-label="Notifications"
          tabIndex={-1}
          className={`z-40 overflow-y-auto rounded-card border border-border bg-surface p-3 outline-none ${panelPlace}`}
        >
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="font-head text-base font-semibold">Notifications</h2>
            <button
              type="button"
              onClick={notes.markAllRead}
              disabled={notes.unread === 0}
              className={`min-h-touch px-2 text-sm font-semibold text-info hover:bg-chrome-raised disabled:font-normal disabled:text-faint ${RING_ON_CANVAS}`}
            >
              Mark all as read
            </button>
          </div>

          <NotificationBody notes={notes} onOpen={opened} />
        </section>
      )}
    </div>
  );
}

// What the panel says: loading, a failure, nothing new or the list.
function NotificationBody({ notes, onOpen }) {
  if (notes.status === 'loading' && notes.items.length === 0) {
    return <p role="status" className="px-1 py-3 text-sm text-muted-foreground">Loading notifications…</p>;
  }
  if (notes.status === 'error') {
    return (
      <div className="px-1 py-3">
        <p role="alert" className="text-sm">Notifications could not load. Check your connection and try again.</p>
        <button type="button" onClick={notes.reload} className={`${BUTTON_OUTLINE} mt-3`}>Try again</button>
      </div>
    );
  }
  if (notes.items.length === 0) {
    return <p className="px-1 py-3 text-sm text-muted-foreground">You are all caught up.</p>;
  }
  return (
    <>
      {notes.partial && <p className="px-1 pt-2 text-xs text-faint">Some notifications could not load.</p>}
      <ul className="mt-2">
        {notes.items.map((item) => {
          const unread = !notes.isRead(item.id);
          return (
            <li key={item.id}>
              <Link
                to={item.to}
                onClick={() => onOpen(item.id)}
                className={`grid grid-cols-[0.75rem_minmax(0,1fr)] gap-3 rounded-control px-2 py-3 hover:bg-chrome-raised ${RING_ON_CANVAS}`}
              >
                <span aria-hidden="true" className={`mt-1.5 h-2 w-2 rounded-full ${unread ? 'bg-primary-text' : ''}`} />
                <span className="min-w-0">
                  <span className={`block text-sm ${unread ? 'font-semibold text-ink' : 'text-muted-foreground'}`}>
                    {item.title}
                    {unread && <span className="ml-2 text-xs font-semibold text-primary-text">New</span>}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{item.text}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

import { NavLink } from 'react-router-dom';
import Icon from '@/components/Icon';
import { RING_ON_CANVAS } from '@/lib/ui';

// Whole-class names so Tailwind builds every column count the bar can have.
const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' };
const ITEM = `flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-control text-xs leading-tight text-muted-foreground ${RING_ON_CANVAS}`;

// The phone bottom bar: up to four quick links for this person and More. It stays at the bottom of
// the screen. The page leaves room for it, so it never covers the content.
export default function BottomBar({ links, moreOpen, onMore }) {
  const count = links.length + 1;
  return (
    <nav
      aria-label="Quick links"
      className={`fixed inset-x-0 bottom-0 z-40 grid gap-1 border-t border-border bg-surface px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] ${COLUMNS[count] ?? 'grid-cols-5'}`}
    >
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => `${ITEM} ${isActive ? 'font-semibold text-ink' : ''}`}
        >
          <Icon name={link.icon} />
          <span>{link.short ?? link.label}</span>
        </NavLink>
      ))}
      <button id="more-button" type="button" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={onMore} className={ITEM}>
        <Icon name="more" />
        <span>More</span>
      </button>
    </nav>
  );
}

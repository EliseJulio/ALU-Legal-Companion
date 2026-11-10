import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { LIVE } from '@/lib/live';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import { useMediaQuery } from '@/lib/useMediaQuery';
import OwnerOnly from '@/components/OwnerOnly';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import StatusPill from '@/components/StatusPill';
import { readableDay, daysUntil } from '@/lib/dates';
import { matterDeadline } from '@/lib/overview';
import {
  RING_ON_CANVAS, BUTTON_PRIMARY, BUTTON_OUTLINE, FIELD, CARD, TAB, TAB_CURRENT, TAB_IDLE,
} from '@/lib/ui';

const CELL = 'px-4 py-4 align-top text-sm';
const HEAD = 'px-4 py-3 text-sm font-semibold text-muted-foreground';
// The two lists of the page.
const VIEWS = [
  { key: 'open', label: 'Open' },
  { key: 'finished', label: 'Finished' },
];

// Private or shared, in words and with a lock. The lock is a picture and the word says it.
function Lock({ shared }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon name="lock" className="text-base" />
      {shared ? 'Shared' : 'Private'}
    </span>
  );
}

// The deadline as words. A deadline within a week is stressed in words as well as in colour.
function Deadline({ matter }) {
  if (!matter.next_due) return <span className="text-muted-foreground">No deadline recorded</span>;
  const days = daysUntil(matter.next_due);
  const urgent = matter.status === 'open' && days !== null && days <= 7;
  return (
    <span className={urgent ? 'font-semibold text-warning-strong' : 'text-muted-foreground'}>
      Deadline {readableDay(matter.next_due)} ({matterDeadline(matter.next_due, matter.status)?.words})
    </span>
  );
}

// One matter per row on a wide screen. The title is plain text and the one link says "Open" with
// the matter's name for a screen reader, so a list of links reads as a list of different places.
function MatterTable({ matters, group }) {
  return (
    <div data-scroll="intended" className="mt-6 overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[52rem] text-left">
        <caption className="sr-only">Your {group} matters with the next step, deadline and who can see each one</caption>
        <thead className="border-b border-border bg-canvas">
          <tr>
            {['Matter', 'Next step', 'Deadline', 'Sharing', 'Open'].map((name) => (
              <th key={name} scope="col" className={HEAD}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {matters.map((m) => (
            <tr key={m.id}>
              <th scope="row" className={`${CELL} font-normal`}>
                <p className="font-semibold text-ink">{m.title}</p>
                <Lock shared={Boolean(m.shared_with_name)} />
              </th>
              <td className={CELL}>{m.next_action || <span className="text-muted-foreground">Nothing recorded</span>}</td>
              <td className={CELL}><Deadline matter={m} /></td>
              <td className={CELL}>{m.shared_with_name ? `Shared with ${m.shared_with_name}` : 'Private · Not shared'}</td>
              <td className={CELL}>
                <Link to={`/matters/${m.id}`} className={`inline-flex min-h-touch items-center font-semibold text-primary-text hover:underline underline-offset-2 ${RING_ON_CANVAS}`}>
                  <span>Open<span aria-hidden="true">&nbsp;→</span>{' '}<span className="sr-only">{m.title}</span></span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The same matters as cards for a phone or a tablet. The whole card is the link.
function MatterCards({ matters }) {
  return (
    <ul className="mt-6 space-y-3">
      {matters.map((m) => (
        <li key={m.id}>
          <Link to={`/matters/${m.id}`} className={`block ${CARD} hover:border-primary ${RING_ON_CANVAS}`}>
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-sans text-base font-semibold text-ink">{m.title}</span>
              <StatusPill status={m.status} />
            </span>
            <span className="mt-1 block"><Lock shared={Boolean(m.shared_with_name)} /></span>
            {m.next_action && <span className="mt-1 block text-sm">Next: {m.next_action}</span>}
            <span className="mt-1 block text-sm"><Deadline matter={m} /></span>
            {m.shared_with_name && (
              <span className="mt-1 block text-xs text-muted-foreground">Shared with {m.shared_with_name}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// A person's own matters. The server sends open ones first, the soonest deadline first and the
// ones with no deadline last. The page filters that one list into Open and Finished.
function MatterList() {
  const { data: matters, error, loading } = useApi('/matters', LIVE);
  const wide = useMediaQuery('(min-width: 1280px)');
  const [view, setView] = useState('open');
  // The server's order is the soonest deadline first. Name order is done here.
  const [sort, setSort] = useState('deadline');

  const open = matters?.filter((m) => m.status === 'open') ?? [];
  const finished = matters?.filter((m) => m.status !== 'open') ?? [];
  const group = view === 'finished' ? 'finished' : 'open';
  const chosen = group === 'open' ? open : finished;
  const shown = sort === 'name' ? [...chosen].sort((a, b) => a.title.localeCompare(b.title)) : chosen;

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="My matters" />
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-head text-[length:clamp(24px,2.7vw,30px)] leading-[1.15] tracking-[-0.01em] text-ink">My matters</h1>
          <p className="mt-3 max-w-reading text-muted-foreground">
            Your private matters and next steps. Only you can see these unless you choose to share
            one with a legal expert.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/matters/new" className={BUTTON_PRIMARY}>New matter</Link>
          <Link to="/directory" className={BUTTON_OUTLINE}>Find where a matter goes</Link>
        </div>
      </div>

      {loading && <p className="mt-6 text-muted-foreground">Loading your matters…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {matters?.length === 0 && (
        <p className={`mt-6 ${CARD} text-muted-foreground`}>
          You are not tracking anything yet.
        </p>
      )}

      {matters?.length > 0 && (
        <>
          {/* Tabs. Each is a button that says which view is on. */}
          {/* The row inside scrolls on a very narrow screen and has 4 px of room on every side, so a
              tab's focus ring (2 px ring + 2 px gap) is never clipped. */}
          <div className="mt-6">
          <div role="group" aria-label="Show matters" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 pt-1">
            {VIEWS.map((v) => {
              const count = v.key === 'open' ? open.length : v.key === 'finished' ? finished.length : null;
              const on = view === v.key;
              return (
                <button
                  key={v.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setView(v.key)}
                  className={`${TAB} shrink-0 ${on ? TAB_CURRENT : TAB_IDLE}`}
                >
                  {v.label}
                  {count !== null && (
                    <>
                      {' '}
                      <span className="rounded-control bg-chrome-raised px-2 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          </div>

          <>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="matter-sort" className="text-sm font-medium">Sort by</label>
                  <Select id="matter-sort" value={sort} onChange={(e) => setSort(e.target.value)} className={`${FIELD} !w-auto`}>
                    <option value="deadline">Deadline, soonest first</option>
                    <option value="name">Name, A to Z</option>
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground">
                  {sort === 'deadline' ? 'Matters without a deadline appear last.' : 'Listed by name.'}
                </p>
              </div>
              {/* Always on the page so the change of list is read out. */}
              <p role="status" className="sr-only">
                {shown.length === 1 ? `Showing 1 ${group} matter` : `Showing ${shown.length} ${group} matters`}
              </p>

              {shown.length === 0 && (
                <p className={`mt-6 ${CARD} text-muted-foreground`}>
                  {group === 'open' ? 'You have no open matters.' : 'You have no finished matters.'}
                </p>
              )}
              {shown.length > 0 && (wide ? <MatterTable matters={shown} group={group} /> : <MatterCards matters={shown} />)}
          </>
        </>
      )}

      <Callout title="Private by default" className="mt-6">
        Only your account can view a matter until you explicitly share it with a chosen expert. A
        public route never exposes your case details.
      </Callout>
    </div>
  );
}

export default function MyMatters() {
  const { user } = useAuth();
  // The list is requested only inside the guard. A visitor never sends a request that would 401.
  return <OwnerOnly>{canOwnActivity(user) && <MatterList />}</OwnerOnly>;
}

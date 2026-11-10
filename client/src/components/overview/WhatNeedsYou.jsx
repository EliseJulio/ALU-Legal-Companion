import { Link } from 'react-router-dom';
import Panel from '@/components/overview/Panel';
import CardState from '@/components/overview/CardState';
import StatusWord from '@/components/overview/StatusWord';
import { daysLeft, deadlineWords, matterStatus } from '@/lib/overview';
import { readableDay } from '@/lib/dates';
import { RING_ON_CANVAS } from '@/lib/ui';
import { useNow } from '@/lib/useNow';

// The area of law of the matter from its route.
// A matter without a route or whose route is no longer published has no area to show.
function areaOf(matter, areas) {
  if (!matter.route_id) return 'Not set';
  return areas?.get(matter.route_id) ?? 'Not available';
}

// One open matter as a row. On a wide screen the four parts sit side by side. On a phone they stack, so
// nothing needs to scroll sideways.
function MatterRow({ matter, row, area, today }) {
  const left = daysLeft(matter, today);
  const status = matterStatus(matter, row, today);
  return (
    <li className="grid gap-2 py-3.5 text-sm first:pt-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center md:gap-4 md:px-2">
      <div className="min-w-0">
        <Link to={`/matters/${matter.id}`} className={`inline-flex min-h-touch items-center break-words font-semibold text-info hover:underline underline-offset-2 ${RING_ON_CANVAS}`}>
          {matter.title}
        </Link>
      </div>
      <p className="text-muted-foreground"><span className="md:hidden">Area: </span>{area}</p>
      <p className="text-muted-foreground">
        <span className="md:hidden">Due: </span>
        {matter.next_due ? `${readableDay(matter.next_due)} (${deadlineWords(left)})` : 'No deadline set'}
      </p>
      <div><StatusWord word={status.word} tone={status.tone} /></div>
    </li>
  );
}

// The open matters with the soonest deadline first and what needs doing.
// It replaces a table so the columns stack on a phone and nothing scrolls sideways.
export default function WhatNeedsYou({ matters, progress, areas, loading, error }) {
  const today = useNow();
  return (
    <Panel id="what-needs-you" title="What needs you" className="lg:col-span-7">
      <CardState
        loading={loading}
        error={error}
        empty={matters?.length === 0 && <p>Nothing is open. Start a matter from the Directory when you need one.</p>}
      >
        {/* The column names, on a wide screen only. On a phone each cell says its own name. */}
        <div aria-hidden="true" className="hidden gap-4 border-b border-border px-2 pb-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
          <span>Matter</span><span>Area</span><span>Due</span><span>Status</span>
        </div>
        <ul aria-label="Open matters" className="divide-y divide-border-soft">
          {matters?.map((m) => (
            <MatterRow
              key={m.id}
              matter={m}
              row={progress?.find((p) => p.id === m.id)}
              area={areaOf(m, areas)}
              today={today}
            />
          ))}
        </ul>
      </CardState>
    </Panel>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import ScheduleGrid from '@/components/ScheduleGrid';
import { ScheduleMark, ScheduleRow } from '@/components/ScheduleItem';
import { RING, TAB_CURRENT, TAB_IDLE, CARD } from '@/lib/ui';
import { todayIso } from '@/lib/dates';
import { MONTH_NAMES, WEEKDAYS, daysInMonth, isoDate, itemsByDay, monthOf, weekOf } from '@/lib/calendar';
import {
  LEGEND, addDays, addMonths, agendaDays, longDay, monthDays, nextAfter, shortWeekDay, weekTitle,
} from '@/lib/schedule';

// The Calendar page view of the schedule. One list of items (lib/schedule.js) feeds all three views.
// So the grid and the day list and the phone agenda cannot disagree.
// On a wide screen the Week and Month switch shows. A phone has the agenda grouped by day and no grid.
const ARROW = `inline-flex min-h-touch min-w-touch items-center justify-center rounded-control border border-control bg-surface text-ink ${RING}`;
const SWITCH = `inline-flex min-h-touch items-center rounded-control px-4 text-sm font-medium ${RING}`;
// The keys for the arrows and the Home and End keys, as steps in days from the day that has focus.
const STEP = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

// The line for the next item after a day. It has the title and the day and the time when there is one.
function nextLine(item) {
  return `Next: ${item.title}, ${longDay(item.date)}${item.time ? ` at ${item.time}` : ''}.`;
}

// `legend` names the circles on the page. `renderRow` draws one item in the day list and the agenda.
// The student page keeps the defaults. A lawyer page and an admin page pass their own.
// So an admin row never offers an action that is not there.
export default function ScheduleCalendar({ items, today, legend = LEGEND, renderRow = (item) => <ScheduleRow item={item} /> }) {
  const todayKey = todayIso(today);
  const [selected, setSelected] = useState(todayKey);
  const [view, setView] = useState('month');
  // The grid moves the focus to the day the arrow keys reached. The focus is set after the grid has
  // drawn that day, so the id of the day is kept here until then.
  const focusDay = useRef(null);
  const gridRef = useRef(null);

  useEffect(() => {
    const target = focusDay.current;
    if (!target) return;
    focusDay.current = null;
    gridRef.current?.querySelector(`[data-day="${target}"]`)?.focus();
  }, [selected]);

  const shown = monthOf(selected) ?? monthOf(todayKey);
  const byDay = useMemo(() => itemsByDay(items, (item) => item.date), [items]);
  const weeks = view === 'week' ? [weekOf(selected)] : monthDays(shown.year, shown.month);
  const heads = view === 'week'
    ? weeks[0].map((iso, i) => `${WEEKDAYS[i]} ${Number(iso.slice(8))}`)
    : WEEKDAYS;
  const monthName = `${MONTH_NAMES[shown.month]} ${shown.year}`;
  const title = view === 'week' ? weekTitle(selected) : monthName;
  const caption = view === 'week'
    ? `${title}, by day.`
    : `${monthName}, by day. Weeks start on Monday.`;

  const step = (by) => setSelected(view === 'week' ? addDays(selected, 7 * by) : addMonths(selected, by));

  // The arrow keys move one day or one week; Home and End go to the first and last day of the week.
  const onDayKey = (event, iso) => {
    let to = null;
    if (event.key in STEP) to = addDays(iso, STEP[event.key]);
    else if (event.key === 'Home') to = weekOf(iso)[0];
    else if (event.key === 'End') to = weekOf(iso)[6];
    if (!to) return;
    event.preventDefault();
    focusDay.current = to;
    setSelected(to);
  };

  const dayItems = byDay.get(selected) ?? [];
  const next = nextAfter(items, selected);
  const days = agendaDays(items, shown.year, shown.month);
  const monthEnd = isoDate(shown.year, shown.month, daysInMonth(shown.year, shown.month));
  const nextAfterMonth = nextAfter(items, monthEnd);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => step(-1)} className={ARROW}>
          <Icon name="chevron_left" />
        </button>
        <h2 aria-live="polite" className="min-w-[9.5ch] text-center font-head text-xl text-ink">{title}</h2>
        <button type="button" aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => step(1)} className={ARROW}>
          <Icon name="chevron_right" />
        </button>
        <button type="button" onClick={() => setSelected(todayKey)} className={`${SWITCH} border border-primary bg-surface text-primary-text`}>
          Today
        </button>
        <div role="group" aria-label="View" className="ml-auto hidden gap-1 rounded-control bg-chrome-raised p-1 md:inline-flex">
          {[['week', 'Week'], ['month', 'Month']].map(([key, label]) => {
            const on = view === key;
            return (
              <button key={key} type="button" aria-pressed={on} onClick={() => setView(key)} className={`${SWITCH} ${on ? TAB_CURRENT : TAB_IDLE}`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 hidden md:block">
        <ScheduleGrid
          gridRef={gridRef}
          weeks={weeks}
          heads={heads}
          caption={caption}
          byDay={byDay}
          shown={shown}
          selected={selected}
          todayKey={todayKey}
          onSelect={setSelected}
          onDayKey={onDayKey}
        />
      </div>

      <section aria-labelledby="schedule-day" className={`mt-6 hidden ${CARD} md:block`}>
        <h2 id="schedule-day" className="font-head text-lg text-ink">
          {longDay(selected)}
          {selected === todayKey && <span className="ml-2 text-sm font-semibold text-primary-text">Today</span>}
        </h2>
        {dayItems.length === 0 ? (
          <div className="mt-2 space-y-1">
            <p className="text-muted-foreground">Nothing on this day.</p>
            <p className="text-sm">{next ? nextLine(next) : 'Nothing else is coming up.'}</p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border-soft">
            {dayItems.map((item) => (
              <li key={item.key} className="py-4 first:pt-0 last:pb-0">
                {renderRow(item)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={`Agenda for ${monthName}`} className="mt-4 md:hidden">
        {days.length === 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground">Nothing in {monthName}.</p>
            <p className="text-sm">{nextAfterMonth ? nextLine(nextAfterMonth) : 'Nothing else is coming up.'}</p>
          </div>
        ) : (
          days.map((iso) => (
            <div key={iso} className="mt-5 first:mt-0">
              <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                {shortWeekDay(iso)}
                {iso === todayKey && <span className="text-sm font-semibold text-primary-text">Today</span>}
              </h3>
              <ul className="mt-2 divide-y divide-border-soft">
                {(byDay.get(iso) ?? []).map((item) => (
                  <li key={item.key} className="py-4 first:pt-0 last:pb-0">
                    {renderRow(item)}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <ul aria-label="Key" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {legend.map(({ mark, words }) => (
          <li key={words} className="inline-flex items-center gap-2">
            <ScheduleMark mark={mark} />
            {words}
          </li>
        ))}
      </ul>
    </div>
  );
}

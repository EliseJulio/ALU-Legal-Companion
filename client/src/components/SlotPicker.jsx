import { useId, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { KIGALI_NOTE } from '@/lib/slots';
import { longDay } from '@/lib/schedule';
import { todayIso } from '@/lib/dates';
import { MONTH_NAMES, monthOf } from '@/lib/calendar';
import {
  monthCells, shiftMonth, isCurrentKigaliMonth, hasOpenDayAfter, groupTimes, confirmLine, stepOpenDay,
} from '@/lib/slotCalendar';
import { RING } from '@/lib/ui';

// The date and time choice for a consultation. `days` comes from slotDays (lib/slots.js). The date
// chosen is `date` and the time is the ISO moment `time`. Both are held by the page, which sends `time`.
// The dates are a month grid. The first open day is shown until another is chosen. The arrow keys move
// between open days, and Enter or Space chooses one. The times are tiles in Morning, Afternoon and Evening.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ARROW = `inline-flex min-h-touch min-w-touch items-center justify-center rounded-control border border-control bg-surface text-ink hover:bg-chrome-raised disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-surface ${RING}`;
const STEP = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
const countWords = (n) => `${n} ${n === 1 ? 'time' : 'times'} open`;
// Every day cell and blank has the same fixed height, so each row is the same height.
const CELL_HEIGHT = 'h-[48px] md:h-[52px]';
// The calendar takes 10 px of the card's side padding on a phone, so seven cells of 44 px fit. Below 360 px
// it takes the whole card width.
const CALENDAR_WIDTH = '-mx-2.5 max-[359px]:-mx-[22px] md:mx-0 md:max-w-md';

// `compact` keeps three tile columns for a narrow panel, such as the Change the time box.
export default function SlotPicker({ days, date, time, onDate, onTime, describedBy, groupRef, compact = false }) {
  const id = useId();
  const day = days.find((d) => d.date === date) ?? days[0];
  // The clock is read once when the picker opens, so render stays free of side effects.
  const [now] = useState(() => new Date());
  const todayKey = todayIso(now);
  const gridRef = useRef(null);

  // The month on screen, and the day the arrow keys last reached. The first open day decides the month.
  const [view, setView] = useState(() => {
    const at = monthOf(day.date);
    return { year: at.year, month: at.month };
  });
  const [focusIso, setFocusIso] = useState(null);

  const openDays = new Map(days.map((d) => [d.date, d]));
  const inView = (iso) => {
    const at = monthOf(iso);
    return at !== null && at.year === view.year && at.month === view.month;
  };
  // The one day of the grid that takes Tab. It is the chosen day when that is on screen.
  const tabStop = focusIso && inView(focusIso)
    ? focusIso
    : (inView(day.date) ? day.date : (days.find((d) => inView(d.date))?.date ?? null));

  const weeks = monthCells(view.year, view.month);
  const monthName = `${MONTH_NAMES[view.month]} ${view.year}`;
  const canPrevious = !isCurrentKigaliMonth(view.year, view.month, now);
  const canNext = hasOpenDayAfter(days, view.year, view.month);
  const picked = day.times.find((t) => t.iso === time);
  const groups = groupTimes(day.times);

  const show = (next) => {
    setView(next);
    setFocusIso(null);
  };

  const onDayKey = (event, iso) => {
    const step = STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const target = stepOpenDay(days, iso, step, view.year, view.month);
    if (!target) return;
    setFocusIso(target);
    gridRef.current?.querySelector(`[data-iso="${target}"]`)?.focus();
  };

  return (
    <div ref={groupRef} tabIndex={-1} className="mt-4 outline-none">
      <fieldset>
        <legend className="text-sm font-semibold">Choose a date</legend>
        <div className={`mt-2 ${CALENDAR_WIDTH}`}>
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!canPrevious}
              onClick={() => show(shiftMonth(view.year, view.month, -1))}
              className={ARROW}
            >
              <Icon name="chevron_left" />
            </button>
            <h3 className="text-center font-head text-lg text-ink">{monthName}</h3>
            <button
              type="button"
              aria-label="Next month"
              disabled={!canNext}
              onClick={() => show(shiftMonth(view.year, view.month, 1))}
              className={ARROW}
            >
              <Icon name="chevron_right" />
            </button>
          </div>

          <div ref={gridRef} role="grid" aria-label={monthName} className="mt-3 grid grid-cols-7 gap-0.5 md:gap-1">
            <div role="row" className="contents">
              {WEEKDAYS.map((name) => (
                <div key={name} role="columnheader" className="flex h-6 items-center justify-center text-xs font-semibold text-muted-foreground">
                  {name}
                </div>
              ))}
            </div>
            {weeks.map((week, rowIndex) => (
              <div key={`week-${rowIndex}`} role="row" className="contents">
                {week.map((iso, cellIndex) => {
                  if (!iso) return <div key={`blank-${cellIndex}`} role="gridcell" aria-hidden="true" className={CELL_HEIGHT} />;
                  const open = openDays.get(iso);
                  const count = open?.count ?? 0;
                  const selected = open !== undefined && iso === day.date;
                  const isToday = iso === todayKey;
                  const dayName = longDay(iso);
                  const label = count > 0
                    ? `${dayName}, ${countWords(count)}`
                    : `${dayName}, no times open`;
                  // Every state keeps a 1 px border, so the box keeps its size when the state changes.
                  const look = selected
                    ? 'border-primary bg-primary-subtle text-primary-text font-semibold'
                    : count > 0
                      ? 'border-control bg-surface text-ink hover:bg-chrome-raised'
                      : 'border-border-soft bg-canvas text-faint';
                  return (
                    <div key={iso} role="gridcell" className="flex min-w-0">
                      <button
                        type="button"
                        data-iso={iso}
                        aria-label={`${label}${isToday ? ', today' : ''}`}
                        aria-pressed={count > 0 ? selected : undefined}
                        disabled={count === 0}
                        tabIndex={iso === tabStop ? 0 : -1}
                        onClick={() => onDate(iso)}
                        onKeyDown={(event) => onDayKey(event, iso)}
                        className={`flex min-h-touch ${CELL_HEIGHT} w-full min-w-0 flex-col items-center justify-center rounded-control border text-base leading-tight tabular-nums disabled:cursor-not-allowed ${look} ${RING}`}
                      >
                        <span className={isToday ? 'font-semibold underline decoration-2 underline-offset-4' : ''}>{Number(iso.slice(8))}</span>
                        {count > 0 && (
                          <>
                            <span aria-hidden="true" className="text-xs leading-none text-primary-text">{count}</span>
                            <span className="sr-only">{countWords(count)}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset aria-describedby={describedBy} className="mt-5">
        <legend className="text-sm font-semibold">Choose a time</legend>
        <p className="mt-1 text-sm text-muted-foreground">{KIGALI_NOTE}</p>
        <p className="mt-1 text-sm text-muted-foreground">Open times on {longDay(day.date)}.</p>
        <div className="mt-3 space-y-4">
          {groups.map((group) => {
            const groupId = `${id}-${group.key}`;
            return (
              <div key={group.key} role="group" aria-labelledby={groupId}>
                <h4 id={groupId} className="text-sm font-semibold text-ink">{group.label}</h4>
                <div className={`mt-2 grid grid-cols-3 gap-2 ${compact ? '' : 'md:grid-cols-4 lg:grid-cols-6'}`}>
                  {group.times.map((t) => {
                    const on = t.iso === time;
                    const descriptionId = `${id}-d-${t.iso.replace(/[^0-9A-Za-z]/g, '')}`;
                    return (
                      <button
                        key={t.iso}
                        type="button"
                        aria-pressed={on}
                        aria-describedby={descriptionId}
                        onClick={() => onTime(t.iso)}
                        className={`flex min-h-touch flex-col items-center justify-center rounded-control border py-3 text-xl font-semibold leading-none tabular-nums hover:bg-chrome-raised ${on ? 'border-primary bg-primary-subtle text-primary-text' : 'border-control bg-surface text-ink'} ${RING}`}
                      >
                        {t.time}
                        <span hidden id={descriptionId}>{`${longDay(day.date)} ${t.time}, 30 minutes`}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {picked && (
          <p aria-live="polite" className="mt-4 text-sm font-semibold text-ink">{confirmLine(day.date, picked.time)}</p>
        )}
      </fieldset>
    </div>
  );
}

import { useState } from 'react';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import { RING, BUTTON_OUTLINE, CARD, SELECT } from '@/lib/ui';
import { todayIso } from '@/lib/dates';
import {
  MONTH_NAMES, WEEKDAYS, monthGrid, shiftMonth, itemsInMonth, itemsByDay, yearRange, monthOf,
} from '@/lib/calendar';

// The one month calendar. My matters and the student Calendar and the lawyer Calendar and the admin Calendar all use it.
// The page passes in what a chip and an agenda row look like so each page keeps its own words.
// Monday is the first column. On a phone the grid is hidden and the agenda carries the same items.
//
// A chip is a short link to its row in the agenda or to a matter.
// Its state is in its words for a screen reader and in its title. The legend says each state in words too.

const ARROW = `inline-flex min-h-touch min-w-touch items-center justify-center rounded-control border border-control bg-surface text-ink ${RING}`;

const byKeyAscending = (key) => (a, b) => {
  const x = key(a) ?? '';
  const y = key(b) ?? '';
  if (x === y) return 0;
  return x < y ? -1 : 1;
};

// The name the grid has for a screen reader. A page can give its own, such as "Appointments in May".
const defaultGridName = (heading) => `${heading}, by day. Weeks start on Monday.`;

export default function MonthCalendar({
  id, items, dateOf, sortKey = dateOf, renderChip, renderRow, legend, legendLabel = 'Key',
  agendaTitle, gridName = defaultGridName, today, emptyWords,
}) {
  const todayKey = todayIso(today);
  const [view, setView] = useState(() => monthOf(todayKey));

  const heading = `${MONTH_NAMES[view.month]} ${view.year}`;
  const grid = monthGrid(view.year, view.month);
  const inMonth = itemsInMonth(items, dateOf, view);
  const byDay = itemsByDay(inMonth, dateOf);
  const agenda = [...inMonth].sort(byKeyAscending(sortKey));

  // The years on offer. The year on screen is always among them, even when an arrow moved past the range.
  const years = [...new Set([...yearRange(items.map(dateOf), today.getFullYear()), view.year])]
    .sort((a, b) => a - b);

  return (
    <section aria-labelledby={`${id}-heading`} className={`min-w-0 ${CARD}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-heading`} className="sr-only">{heading}</h2>
        <div role="group" aria-label="Choose a month and year" className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-month`} className="sr-only">Month</label>
          <Select
              id={`${id}-month`}
              value={view.month}
              onChange={(e) => setView({ year: view.year, month: Number(e.target.value) })}
              className={SELECT}
            >
              {MONTH_NAMES.map((name, i) => <option key={name} value={i}>{name}</option>)}
          </Select>
          <label htmlFor={`${id}-year`} className="sr-only">Year</label>
          <Select
              id={`${id}-year`}
              value={view.year}
              onChange={(e) => setView({ year: Number(e.target.value), month: view.month })}
              className={SELECT}
            >
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => setView((v) => shiftMonth(v, -1))} className={ARROW}>
            <Icon name="chevron_left" />
          </button>
          <button type="button" onClick={() => setView(monthOf(todayKey))} className={BUTTON_OUTLINE}>Today</button>
          <button type="button" aria-label="Next month" onClick={() => setView((v) => shiftMonth(v, 1))} className={ARROW}>
            <Icon name="chevron_right" />
          </button>
        </div>
      </div>

      {/* The grid is for a wide screen. A phone reads the agenda below, which holds the same items. */}
      <table className="mt-4 hidden w-full table-fixed border-collapse md:table">
        <caption className="sr-only">{gridName(heading)}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((name) => (
              <th key={name} scope="col" className="border border-border-soft px-2 py-2 text-left text-xs font-medium text-muted-foreground">{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((week, row) => (
            <tr key={row}>
              {week.map((cell, column) => {
                if (!cell) {
                  return <td key={`empty-${column}`} aria-hidden="true" className="border border-border-soft bg-chrome-raised" />;
                }
                const isToday = cell.iso === todayKey;
                const chips = byDay.get(cell.iso) ?? [];
                return (
                  <td key={cell.iso} aria-current={isToday ? 'date' : undefined} className="h-24 border border-border-soft p-1.5 align-top">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-soft text-xs font-medium ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
                      {cell.day}
                    </span>
                    {chips.length > 0 && (
                      <ul className="mt-1 space-y-1">
                        {chips.map((item, i) => <li key={item.id ?? `${cell.iso}-${i}`} className="min-w-0">{renderChip(item)}</li>)}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {agendaTitle && <h3 className="mt-6 font-head text-base text-ink">{agendaTitle}</h3>}
      {agenda.length === 0 ? (
        <p className="mt-4 text-muted-foreground">{emptyWords}</p>
      ) : (
        <ul aria-label={`Agenda for ${heading}`} className="mt-4 divide-y divide-border-soft">
          {agenda.map((item, i) => (
            <li key={item.id ?? i} id={item.id != null ? `${id}-${item.id}` : undefined} className="scroll-mt-6 py-3">
              {renderRow(item)}
            </li>
          ))}
        </ul>
      )}

      {legend?.length > 0 && (
        <ul aria-label={legendLabel} className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {legend.map(({ swatch, words }) => (
            <li key={words} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={`inline-block size-3 rounded-full border ${swatch}`} />
              {words}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

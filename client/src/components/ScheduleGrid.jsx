import { RING } from '@/lib/ui';
import { dayAria } from '@/lib/schedule';
import { monthOf } from '@/lib/calendar';
import { ScheduleChip } from '@/components/ScheduleItem';

// The grid is a real table: a row of day names then the weeks.
// Every day is a button with its own label (the day and its count and its state).
// So a keyboard moves from day to day with the arrow keys. The chips sit in their day's cell.
// This grid shows from the tablet width up. A phone reads the agenda.
const DAY_BUTTON = `inline-flex min-h-touch min-w-touch items-center gap-1.5 rounded-control px-1 text-sm font-medium tabular-nums ${RING}`;
const NUMBER = 'inline-flex size-7 items-center justify-center rounded-soft';

export default function ScheduleGrid({
  weeks, heads, caption, byDay, shown, selected, todayKey, onSelect, onDayKey, gridRef,
}) {
  return (
    <table ref={gridRef} className="w-full table-fixed border-collapse">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {heads.map((head) => (
            <th key={head} scope="col" className="border border-border-soft px-2 py-2 text-left text-xs font-medium text-muted-foreground">
              {head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]}>
            {week.map((iso) => {
              const list = byDay.get(iso) ?? [];
              const isToday = iso === todayKey;
              const isSelected = iso === selected;
              const outside = monthOf(iso)?.month !== shown.month || monthOf(iso)?.year !== shown.year;
              const surface = isSelected ? 'bg-chrome-raised' : outside ? 'bg-canvas' : 'bg-surface';
              return (
                <td
                  key={iso}
                  aria-current={isToday ? 'date' : undefined}
                  className={`min-h-[7.5rem] border border-border-soft p-1.5 align-top ${surface}`}
                >
                  <button
                    type="button"
                    data-day={iso}
                    aria-label={dayAria(iso, list.length, { isToday, selected: isSelected })}
                    onClick={() => onSelect(iso)}
                    onKeyDown={(event) => onDayKey(event, iso)}
                    className={`${DAY_BUTTON} ${outside ? 'text-faint' : 'text-ink'}`}
                  >
                    <span aria-hidden="true" className={`${NUMBER} ${isToday ? 'bg-primary-subtle font-bold text-primary-text' : ''}`}>
                      {Number(iso.slice(8))}
                    </span>
                    {isToday && <span aria-hidden="true" className="text-xs font-semibold text-primary-text">Today</span>}
                  </button>
                  {list.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {list.map((item) => (
                        <li key={item.key} className="min-w-0">
                          <ScheduleChip item={item} onSelect={onSelect} />
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

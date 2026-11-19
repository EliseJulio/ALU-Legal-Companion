// Calendar arithmetic and time groups for the slot picker. No React here, so it can be tested alone.
// Dates are 'YYYY-MM-DD' strings and months are numbered from 0, as in JavaScript. Every sum is in UTC.
import { isoDate, daysInMonth, monthOf } from '@/lib/calendar';
import { todayIso } from '@/lib/dates';
import { longDay } from '@/lib/schedule';

const DAY = 86400000;

const utcOf = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms) => {
  const d = new Date(ms);
  return isoDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

// The weeks of one month, Monday first. Each week has seven entries: a 'YYYY-MM-DD' or null for a blank
// that falls outside the month. Every row has seven cells, so the grid is never ragged.
export function monthCells(year, month) {
  const leading = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const cells = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth(year, month); day += 1) cells.push(isoDate(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// The month a number of months away from a given one. Negative numbers go back.
export function shiftMonth(year, month, by) {
  const total = year * 12 + month + by;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

// True when the month is the month of today in Kigali time, which is the earliest month the picker shows.
export function isCurrentKigaliMonth(year, month, now = new Date()) {
  const today = monthOf(todayIso(now));
  return today.year === year && today.month === month;
}

// True when some open day falls in a month after the given one.
export function hasOpenDayAfter(days, year, month) {
  return days.some(({ date }) => {
    const at = monthOf(date);
    return at !== null && (at.year > year || (at.year === year && at.month > month));
  });
}

// The group a start time belongs to, by its Kigali clock 'HH:MM': before 12:00 is morning, before 18:00 is afternoon.
export function timeGroupOf(time) {
  const hour = Number(String(time).slice(0, 2));
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

const TIME_GROUPS = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
];

// The times split into Morning, Afternoon and Evening. A group with no times is left out.
export function groupTimes(times) {
  return TIME_GROUPS
    .map((group) => ({ ...group, times: times.filter((t) => timeGroupOf(t.time) === group.key) }))
    .filter((group) => group.times.length > 0);
}

// The plain sentence after a time is picked, such as 'You chose Thursday 1 January at 09:30, Kigali time.'
export function confirmLine(date, time) {
  return `You chose ${longDay(date)} at ${time}, Kigali time.`;
}

// The next open day in one direction, moving by `step` days (1 or -1 for a day, 7 or -7 for a week).
// It stays inside the given month, so the arrow keys never leave the grid. Null when there is none.
export function stepOpenDay(days, iso, step, year, month) {
  const open = new Set(days.map((d) => d.date));
  for (let ms = utcOf(iso) + step * DAY; ; ms += step * DAY) {
    const candidate = fromUtc(ms);
    const at = monthOf(candidate);
    if (at.year !== year || at.month !== month) return null;
    if (open.has(candidate)) return candidate;
  }
}

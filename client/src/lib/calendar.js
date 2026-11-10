// Month-grid arithmetic for the matters and appointments calendars. No React here, so it can be
// tested on its own. Dates are 'YYYY-MM-DD' strings. Every sum is done in UTC, so a Kigali deadline
// never shifts a day (the same rule as lib/dates.js). Months are numbered 0 to 11, as in JavaScript.
import { daysUntil } from '@/lib/dates';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// The week starts on Monday, as in Rwanda and most of the world outside the US.
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// How close a deadline is. Late: the day has passed. Soon: today or within seven days. Later: more.
export const LATE = 'late';
export const SOON = 'soon';
export const LATER = 'later';
const SOON_DAYS = 7;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 'YYYY-MM-DD' for a year and a month numbered from 0 and a day of the month.
export function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// The year and month a 'YYYY-MM-DD' string falls in. Null for anything else.
export function monthOf(iso) {
  if (!DATE_RE.test(iso ?? '')) return null;
  const [year, month] = iso.split('-').map(Number);
  return { year, month: month - 1 };
}

// Where the 1st of a month falls: 0 for Monday up to 6 for Sunday.
export function leadDays(year, month) {
  return (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

// The weeks of a month with Monday first. A week is seven cells.
// A cell is { day, iso } or null for the empty places before the 1st and after the last.
// A month has 4 or 5 or 6 weeks.
export function monthGrid(year, month) {
  const lead = leadDays(year, month);
  const days = daysInMonth(year, month);
  const cells = Math.ceil((lead + days) / 7) * 7;
  const weeks = [];
  for (let start = 0; start < cells; start += 7) {
    const week = [];
    for (let column = 0; column < 7; column += 1) {
      const day = start + column - lead + 1;
      week.push(day >= 1 && day <= days ? { day, iso: isoDate(year, month, day) } : null);
    }
    weeks.push(week);
  }
  return weeks;
}

// The month before or after `view`. The year wraps. `by` is 1 for the next month and -1 for the last.
export function shiftMonth(view, by) {
  const total = view.year * 12 + view.month + by;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

// The years a year dropdown offers. From the earliest date's year less one to the latest's plus one.
// It is never narrower than last year to two years ahead of this one, so a reader can always move
// forward into next year without a matter first.
export function yearRange(isoDates, todayYear) {
  let first = todayYear - 1;
  let last = todayYear + 2;
  for (const iso of isoDates) {
    const at = monthOf(iso);
    if (!at) continue;
    first = Math.min(first, at.year - 1);
    last = Math.max(last, at.year + 1);
  }
  const years = [];
  for (let year = first; year <= last; year += 1) years.push(year);
  return years;
}

// The items that fall in one month, in the order they were given. The caller sorts them.
export function itemsInMonth(items, dateOf, view) {
  return items.filter((item) => {
    const at = monthOf(dateOf(item));
    return at !== null && at.year === view.year && at.month === view.month;
  });
}

// The items on each day, keyed by 'YYYY-MM-DD'. Each day keeps the order it was given.
export function itemsByDay(items, dateOf) {
  const byDay = new Map();
  for (const item of items) {
    const iso = dateOf(item);
    if (!monthOf(iso)) continue;
    byDay.set(iso, [...(byDay.get(iso) ?? []), item]);
  }
  return byDay;
}

// The state of a deadline, read against today. The words are the ones the chips and the agenda show.
// Null for a date that cannot be read, so the caller can leave that item off the calendar.
export function deadlineState(iso, today = new Date()) {
  const days = daysUntil(iso, today);
  if (days === null) return null;
  if (days < 0) {
    const ago = -days;
    return { state: LATE, days, word: `Late by ${ago} ${ago === 1 ? 'day' : 'days'}` };
  }
  if (days === 0) return { state: SOON, days, word: 'Due today' };
  if (days === 1) return { state: SOON, days, word: 'Due tomorrow' };
  if (days <= SOON_DAYS) return { state: SOON, days, word: `Due in ${days} days` };
  return { state: LATER, days, word: `Due in ${days} days` };
}

// A day as a short label, such as "7 Nov". Read in UTC so the day is the day written in the date.
export function shortDay(iso) {
  const at = monthOf(iso);
  if (!at) return '';
  const [, , day] = iso.split('-').map(Number);
  return new Date(Date.UTC(at.year, at.month, day)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

// ---- Booking helpers ----

const two = (n) => String(n).padStart(2, '0');

// The seven days of the week that holds `iso`, Monday first and Sunday last. Empty for a date that
// cannot be read. Sundays belong to the week that is ending, so a Sunday is never the next week's.
export function weekOf(iso) {
  const at = monthOf(iso);
  if (!at) return [];
  const [, , day] = iso.split('-').map(Number);
  const utc = Date.UTC(at.year, at.month, day);
  // getUTCDay gives Sunday as 0. Shift so Monday is 0 and Sunday is 6.
  const offset = (new Date(utc).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(utc - offset * 86400000 + i * 86400000);
    return isoDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  });
}

// The reader's own calendar day for a booking slot as 'YYYY-MM-DD'.
// A slot is a real moment so it is read with local getters. That is the day on the reader's clock.
// Null if unreadable.
export function dayOfSlot(raw) {
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return null;
  return isoDate(when.getFullYear(), when.getMonth(), when.getDate());
}

// The hour and minute of a slot in the reader's zone, such as '10:00'. Null if unreadable.
export function timeOfSlot(raw) {
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return null;
  return `${two(when.getHours())}:${two(when.getMinutes())}`;
}

// How a booking looks on the calendar. Each state has a word so colour is never the only cue.
//   accepted   a confirmed time still to come
//   requested  waiting for the lawyer
//   past       a time that has gone by or a finished booking
//   declined   a time that was not taken
export function chipStateOf(booking, now = new Date()) {
  if (booking.status === 'declined') return 'declined';
  if (booking.status === 'completed') return 'past';
  const when = new Date(booking.slot);
  if (!Number.isNaN(when.getTime()) && when.getTime() < now.getTime()) return 'past';
  if (booking.status === 'accepted') return 'accepted';
  if (booking.status === 'requested') return 'requested';
  return 'past';
}

// The words for each booking state. Used on chips, in the legend and in lists.
export const STATE_WORDS = {
  accepted: 'Accepted',
  requested: 'Requested',
  past: 'Past',
  declined: 'Declined',
};

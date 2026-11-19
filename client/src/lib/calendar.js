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

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
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

// How a booking looks on the calendar. Each state has a word so colour is never the only cue.
//   accepted   a confirmed time still to come
//   requested  waiting for the lawyer
//   past       a time that has gone by or a finished booking
//   declined   a time that was not taken
//   cancelled  a time the person or the lawyer took back
export function chipStateOf(booking, now = new Date()) {
  if (booking.status === 'declined') return 'declined';
  if (booking.status === 'cancelled') return 'cancelled';
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
  cancelled: 'Cancelled',
};

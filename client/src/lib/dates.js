// Dates use the en-GB format on every machine, for example 1 September 2026.
// A DATE column arrives as 'YYYY-MM-DD'. It is printed as a calendar date and never through
// new Date() in the local zone. That would show the day before for anyone west of UTC.
export function readableDay(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate ?? '')) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

// A timestamp such as the moment of a verification. Returns null for anything unreadable so
// the page can decide what to show. It never prints the text "Invalid Date".
export function readableDate(raw) {
  if (typeof raw !== 'string' || raw === '') return null;
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: KIGALI_ZONE,
  });
}

// The zone every consultation time is shown in. Kigali has no daylight saving, so it is always UTC+2.
export const KIGALI_ZONE = 'Africa/Kigali';
// Kigali is UTC+2 all year, so its midnight is 22:00 UTC on the day before.
export const KIGALI_UTC_OFFSET_MS = 2 * 60 * 60 * 1000;

const KIGALI_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: KIGALI_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

// The Kigali calendar day of a timestamp from the server, as 'YYYY-MM-DD'. The server sends UTC, so
// cutting its text would show the UTC day, which is the day before for a late evening in Kigali.
export function kigaliDay(raw) {
  if (typeof raw !== 'string' || raw === '') return null;
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return null;
  return KIGALI_DAY.format(when);
}

const KIGALI_CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: KIGALI_ZONE });

// The clock time of a moment in Kigali, such as '09:30'. Null for a value that cannot be read.
export function kigaliTime(raw) {
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return null;
  return KIGALI_CLOCK.format(when);
}

// Today as 'YYYY-MM-DD' in Kigali time, whatever the browser's zone. It is the latest date a "when did
// this happen" box may hold, and the day a deadline is counted from.
export function todayIso(today = new Date()) {
  return kigaliDay(today.toISOString());
}

// How many days from today a date is. Negative means it has passed. A deadline shown as
// "2026-10-08" makes the reader do sums. "in 6 days" does not.
export function daysUntil(isoDate, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate ?? '')) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const due = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = todayIso(today).split('-').map(Number);
  const now = Date.UTC(ty, tm - 1, td);
  return Math.round((due - now) / 86400000);
}

export function dueInWords(isoDate, today = new Date()) {
  const n = daysUntil(isoDate, today);
  if (n === null) return null;
  if (n < -1) return `${-n} days ago`;
  if (n === -1) return 'yesterday';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

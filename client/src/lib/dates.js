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
  return when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Today as 'YYYY-MM-DD' in the reader's own zone. It is the latest date a "when did this
// happen" box may hold.
export function todayIso(today = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${today.getFullYear()}-${two(today.getMonth() + 1)}-${two(today.getDate())}`;
}

// How many days from today a date is. Negative means it has passed. A deadline shown as
// "2026-10-08" makes the reader do sums. "in 6 days" does not.
export function daysUntil(isoDate, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate ?? '')) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const due = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
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

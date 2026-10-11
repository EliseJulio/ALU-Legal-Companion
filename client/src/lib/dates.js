// A DATE column arrives as 'YYYY-MM-DD'. It is printed as a calendar date and never through
// new Date() in the local zone. That would show the day before for anyone west of UTC.
export function readableDay(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate ?? '')) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

// A timestamp such as the moment of a verification. Returns null for anything unreadable so
// the page can decide what to show. It never prints the text "Invalid Date".
export function readableDate(raw) {
  if (typeof raw !== 'string' || raw === '') return null;
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

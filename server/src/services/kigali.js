// Rwanda is UTC+2 all year. Today for a deadline is today in Kigali and not on the server clock.
export function kigaliToday(now = new Date()) {
  return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// A moment written for a person in Kigali, such as "Tuesday 24 November 2026, 10:00".
export function kigaliDateTime(value) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Africa/Kigali', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

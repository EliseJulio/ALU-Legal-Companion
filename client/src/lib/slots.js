// Open consultation times, shown in Kigali time. No React here so it can be tested on its own.
// A slot is an exact moment sent as UTC. Its clock time is read in the Kigali zone, never in the
// zone of the browser, so a visitor abroad still sees the lawyer's hours.
import { longDay } from '@/lib/schedule';
import { KIGALI_ZONE, kigaliTime } from '@/lib/dates';

export { kigaliTime };
export const KIGALI_NOTE = 'Times are in Kigali time (UTC+2).';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fullSlot = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: KIGALI_ZONE,
});

// A whole moment in Kigali time, such as 'Friday 6 November 2026, 10:00 (Kigali time)'. Null when unreadable.
export function kigaliSlotLabel(iso) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  return `${fullSlot.format(when)} (Kigali time)`;
}

// The days the slots endpoint returned, ready to draw. A day with no readable time is left out, so the
// reader never picks a date that has nothing under it.
export function slotDays(payload) {
  const days = Array.isArray(payload?.days) ? payload.days : [];
  return days
    .filter((day) => DATE_RE.test(day?.date ?? ''))
    .map((day) => {
      const times = (day.slots ?? [])
        .map((iso) => ({ iso, time: kigaliTime(iso) }))
        .filter((t) => t.time !== null)
        .sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
      return { date: day.date, label: longDay(day.date), count: times.length, times };
    })
    .filter((day) => day.count > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

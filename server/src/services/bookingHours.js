// Consultation hours. An entry is open in weekly windows, and each window is cut into 30-minute
// slots. Every time here is Kigali time, which is UTC+2 all year, so no clock change is needed.
//
// An entry that has never saved hours uses DEFAULT_WINDOWS. Those are not stored. Once the lawyer
// saves, the saved windows replace them, and an empty save closes the entry.
import { q } from '../db.js';
import { addDays, isDateString } from './reminders.js';
import { kigaliToday } from './kigali.js';

export const SLOT_MINUTES = 30;
export const TIMEZONE = 'Africa/Kigali';
export const MAX_WINDOWS = 14;
export const MAX_RANGE_DAYS = 31;
export const MAX_OPEN_REQUESTS = 3;

const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const LEAD_MS = 60 * MINUTE_MS;
const HORIZON_MS = 60 * 24 * 60 * MINUTE_MS;

// Monday to Friday, 09:00 to 17:00. Used until the lawyer saves hours.
export const DEFAULT_WINDOWS = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_minute: 540, end_minute: 1020 }));

export const MESSAGES = {
  notList: 'windows must be a list of consultation windows.',
  tooMany: `A lawyer can set at most ${MAX_WINDOWS} consultation windows.`,
  weekday: 'Each window needs a weekday from 1 (Monday) to 7 (Sunday).',
  time: 'Each window needs a start and an end written as HH:MM, such as 09:00.',
  grid: 'Times must be on the half hour, such as 09:00 or 09:30.',
  order: 'Each window must end after it starts.',
  overlap: 'Two windows on the same day overlap.',
  notAvailable: 'That time is not available. Choose one of the times shown.',
  closed: 'This lawyer has no open times right now.',
  notBookable: 'This provider does not take online bookings yet',
  cap: 'You already have open requests with this lawyer. Wait for an answer or cancel one.',
  fromDate: 'from must be a date such as 2026-12-01.',
  toDate: 'to must be a date such as 2026-12-14.',
  toBeforeFrom: 'to must be on or after from.',
  range: `The range can be at most ${MAX_RANGE_DAYS} days.`,
};

const hhmm = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

// The windows as the API shows them: weekday and HH:MM times.
export function toApi(windows) {
  return windows.map((w) => ({ weekday: w.weekday, start: hhmm(w.start_minute), end: hhmm(w.end_minute) }));
}

// Parses HH:MM into minutes after midnight. "24:00" is allowed only as the end of a window.
function parseTime(text, allowMidnight) {
  if (typeof text !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (minute > 59) return null;
  if (hour === 24 && minute === 0 && allowMidnight) return 1440;
  if (hour > 23) return null;
  return hour * 60 + minute;
}

// Checks a list of windows sent by a lawyer. Returns { windows } sorted by day and start, or { error }.
export function validateWindows(input) {
  if (!Array.isArray(input)) return { error: MESSAGES.notList };
  if (input.length > MAX_WINDOWS) return { error: MESSAGES.tooMany };
  const windows = [];
  for (const w of input) {
    if (!w || typeof w !== 'object' || !Number.isInteger(w.weekday) || w.weekday < 1 || w.weekday > 7) {
      return { error: MESSAGES.weekday };
    }
    const start = parseTime(w.start, false);
    const end = parseTime(w.end, true);
    if (start === null || end === null) return { error: MESSAGES.time };
    if (start % SLOT_MINUTES !== 0 || end % SLOT_MINUTES !== 0) return { error: MESSAGES.grid };
    if (start >= end) return { error: MESSAGES.order };
    windows.push({ weekday: w.weekday, start_minute: start, end_minute: end });
  }
  windows.sort((a, b) => a.weekday - b.weekday || a.start_minute - b.start_minute);
  // Sorted by start, two windows on one day overlap exactly when two neighbours do.
  for (let i = 1; i < windows.length; i += 1) {
    const [a, b] = [windows[i - 1], windows[i]];
    if (a.weekday === b.weekday && b.start_minute < a.end_minute) return { error: MESSAGES.overlap };
  }
  return { windows };
}

// The hours that apply to an entry now. Saved windows are read from the table. An entry that has
// never saved gets the standard hours, which are not written anywhere.
export async function hoursOf(providerId) {
  const [p] = await q('SELECT availability_set_at FROM providers WHERE id = $1', [providerId]);
  if (!p?.availability_set_at) return { windows: DEFAULT_WINDOWS, isDefault: true };
  const windows = await q(
    `SELECT weekday, start_minute, end_minute FROM provider_availability
      WHERE provider_id = $1 ORDER BY weekday, start_minute`, [providerId]);
  return { windows, isDefault: false };
}

// True only for a published entry that takes bookings. Anything else is not offered to anyone.
export async function isBookable(providerId) {
  const [p] = await q(`SELECT id FROM providers WHERE id = $1 AND bookable = true AND status = 'published'`, [providerId]);
  return Boolean(p);
}

// The Kigali date, weekday (1 Monday ... 7 Sunday) and minute of the day for a moment.
export function kigaliParts(instant) {
  const local = new Date(instant.getTime() + KIGALI_OFFSET_MS);
  return {
    date: local.toISOString().slice(0, 10),
    weekday: local.getUTCDay() || 7,
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

const onGrid = (instant) => instant.getTime() % MINUTE_MS === 0 && kigaliParts(instant).minute % SLOT_MINUTES === 0;

// The whole slot must fit inside one window of its day.
function insideWindows(windows, instant) {
  const p = kigaliParts(instant);
  return windows.some((w) => w.weekday === p.weekday && w.start_minute <= p.minute
    && p.minute + SLOT_MINUTES <= w.end_minute);
}

// At least 60 minutes from now, and no more than 60 days ahead.
function inBookingRange(instant, now) {
  const ahead = instant.getTime() - now.getTime();
  return ahead >= LEAD_MS && ahead <= HORIZON_MS;
}

// Why a request for this slot cannot be taken, or null when it can. The same rules serve
// signed-in and anonymous requests. A request does not hold the slot, so only an accepted
// booking at that time blocks it.
export async function requestProblem(providerId, instant, now = new Date()) {
  const { windows } = await hoursOf(providerId);
  if (!windows.length) return MESSAGES.closed;
  if (!onGrid(instant) || !insideWindows(windows, instant) || !inBookingRange(instant, now)) {
    return MESSAGES.notAvailable;
  }
  const [taken] = await q(
    `SELECT 1 FROM bookings WHERE provider_id = $1 AND status = 'accepted' AND slot = $2`,
    [providerId, instant.toISOString()]);
  return taken ? MESSAGES.notAvailable : null;
}

// Every open slot of an entry from one Kigali date to another, grouped by date. A day with no open
// slot is left out. Taken slots are missing from the list and nothing says who took them.
export async function openDays(providerId, from, to, now = new Date()) {
  const { windows } = await hoursOf(providerId);
  if (!windows.length) return [];
  const rangeStart = new Date(`${from}T00:00:00Z`).getTime() - KIGALI_OFFSET_MS;
  const rangeEnd = new Date(`${to}T00:00:00Z`).getTime() - KIGALI_OFFSET_MS + 24 * 60 * 60 * 1000;
  const taken = new Set((await q(
    `SELECT slot FROM bookings WHERE provider_id = $1 AND status = 'accepted' AND slot >= $2 AND slot < $3`,
    [providerId, new Date(rangeStart), new Date(rangeEnd)],
  )).map((r) => new Date(r.slot).toISOString()));

  const days = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    // Midnight in Kigali on this date, as a UTC moment.
    const midnight = new Date(`${date}T00:00:00Z`).getTime() - KIGALI_OFFSET_MS;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
    const slots = [];
    for (const w of windows) {
      if (w.weekday !== weekday) continue;
      for (let m = w.start_minute; m + SLOT_MINUTES <= w.end_minute; m += SLOT_MINUTES) {
        const instant = new Date(midnight + m * MINUTE_MS);
        if (!inBookingRange(instant, now)) continue;
        const iso = instant.toISOString();
        if (!taken.has(iso)) slots.push(iso);
      }
    }
    if (slots.length) days.push({ date, slots: slots.sort() });
  }
  return days;
}

// The from and to dates of a free-times request. from defaults to today in Kigali and to to 13 days
// after from. Returns { from, to } or { error }.
export function dateRange(query, now = new Date()) {
  const from = query.from ?? kigaliToday(now);
  if (!isDateString(from)) return { error: MESSAGES.fromDate };
  const to = query.to ?? addDays(from, 13);
  if (!isDateString(to)) return { error: MESSAGES.toDate };
  if (to < from) return { error: MESSAGES.toBeforeFrom };
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (24 * 60 * 60 * 1000);
  if (span > MAX_RANGE_DAYS) return { error: MESSAGES.range };
  return { from, to };
}

// The 30-minute slots of one week of consultation hours. No React here, so the rules can be tested alone.
// A slot is a set key 'weekday:minute', where weekday is 1 (Monday) to 7 (Sunday) and minute is the start
// counted from midnight. The draft is a Set of slots and is never sent as it is: windowsOf turns it into the
// windows the server stores.
import { WEEKDAY_NAMES } from '@/lib/hours';

export const SLOT_MINUTES = 30;
const DAY_END = 1440;
// The slots shown first: 06:00 up to, not including, 22:00.
export const CORE_START = 360;
export const CORE_END = 1320;
const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

export const hhmm = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

// 'HH:MM' to minutes from midnight. '24:00' is the end of the day.
export const parseHhmm = (text) => {
  const [hour, minute] = String(text).split(':').map(Number);
  return hour * 60 + minute;
};

// The weekday of a 'YYYY-MM-DD' date, 1 for Monday to 7 for Sunday. It is read in UTC, so the date is the day written.
export const weekdayOf = (iso) => ((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

export const slotKey = (weekday, minute) => `${weekday}:${minute}`;

// The open start minutes of one weekday, in order.
export function openMinutes(slots, weekday) {
  const minutes = [];
  for (const key of slots) {
    const [day, minute] = key.split(':').map(Number);
    if (day === weekday) minutes.push(minute);
  }
  return minutes.sort((a, b) => a - b);
}

// Every slot inside the saved windows.
export function slotsOf(windows = []) {
  const slots = new Set();
  for (const w of windows) {
    const end = parseHhmm(w.end);
    for (let minute = parseHhmm(w.start); minute + SLOT_MINUTES <= end; minute += SLOT_MINUTES) {
      slots.add(slotKey(w.weekday, minute));
    }
  }
  return slots;
}

// The windows that cover the open slots. Neighbouring slots of one day become one window.
export function windowsOf(slots) {
  const windows = [];
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    let start = null;
    let previous = null;
    for (const minute of openMinutes(slots, weekday)) {
      if (start !== null && minute === previous + SLOT_MINUTES) {
        previous = minute;
        continue;
      }
      if (start !== null) windows.push({ weekday, start: hhmm(start), end: hhmm(previous + SLOT_MINUTES) });
      start = minute;
      previous = minute;
    }
    if (start !== null) windows.push({ weekday, start: hhmm(start), end: hhmm(previous + SLOT_MINUTES) });
  }
  return windows;
}

// A new set with one slot flipped. The set that was passed is not changed.
export function toggleSlot(slots, weekday, minute) {
  const next = new Set(slots);
  const key = slotKey(weekday, minute);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

// A new set where one weekday has exactly the given start minutes open.
export function setDay(slots, weekday, minutes) {
  const next = new Set([...slots].filter((key) => Number(key.split(':')[0]) !== weekday));
  for (const minute of minutes) next.add(slotKey(weekday, minute));
  return next;
}

// Opens every slot from one time up to another on one weekday, and nothing else on that day.
export function openRange(slots, weekday, start, end) {
  const minutes = [];
  for (let minute = parseHhmm(start); minute + SLOT_MINUTES <= parseHhmm(end); minute += SLOT_MINUTES) {
    minutes.push(minute);
  }
  return setDay(slots, weekday, minutes);
}

export function closeDay(slots, weekday) {
  return setDay(slots, weekday, []);
}

// Copies one weekday's open slots onto other weekdays, replacing what those days had.
export function copyDay(slots, fromWeekday, toWeekdays) {
  const minutes = openMinutes(slots, fromWeekday);
  return toWeekdays.reduce((acc, weekday) => setDay(acc, weekday, minutes), slots);
}

// How many slots differ between the draft and the saved set.
export function changeCount(draft, saved) {
  let count = 0;
  for (const key of draft) if (!saved.has(key)) count += 1;
  for (const key of saved) if (!draft.has(key)) count += 1;
  return count;
}

// True when a slot is outside the first view, 06:00 to 22:00.
const outsideCore = (minute) => minute < CORE_START || minute >= CORE_END;

// The start minutes a day shows. 06:00 to 21:30 by default. All 48 when asked, or when an open slot
// or a consultation sits outside the default view, so nothing open is hidden.
export function visibleMinutes(slots, weekday, { showAll = false, must = [] } = {}) {
  const forced = must.some(outsideCore) || openMinutes(slots, weekday).some(outsideCore);
  const all = showAll || forced;
  const minutes = [];
  for (let minute = all ? 0 : CORE_START; minute < (all ? DAY_END : CORE_END); minute += SLOT_MINUTES) {
    minutes.push(minute);
  }
  return minutes;
}

const GROUPS = [
  { key: 'night', label: 'Night', from: 0, to: 360 },
  { key: 'morning', label: 'Morning', from: 360, to: 720 },
  { key: 'afternoon', label: 'Afternoon', from: 720, to: 1080 },
  { key: 'evening', label: 'Evening', from: 1080, to: 1440 },
];

// The shown minutes split into Night, Morning, Afternoon and Evening. A group with no minutes is left out.
export function groupMinutes(minutes) {
  return GROUPS
    .map((g) => ({ ...g, minutes: minutes.filter((m) => m >= g.from && m < g.to) }))
    .filter((g) => g.minutes.length > 0);
}

// "Thursday 09:00 to 09:30, open". The screen reader reads the day, the half hour and the word.
export function slotLabel(weekday, minute, word) {
  return `${WEEKDAY_NAMES[weekday]} ${hhmm(minute)} to ${hhmm(minute + SLOT_MINUTES)}, ${word}`;
}

// A slot is past when it starts before now. Any earlier date is past. Dates are 'YYYY-MM-DD' in Kigali time,
// and nowMinute is the Kigali clock time of now in minutes.
export function isPastSlot(iso, minute, today, nowMinute) {
  if (iso < today) return true;
  return iso === today && minute < nowMinute;
}

// The consultations of one date, keyed by the start minute of their slot. An accepted one wins over a request.
export function consultsOnDay(items, iso) {
  const map = new Map();
  for (const item of items) {
    if (item.kind !== 'consult' || item.date !== iso || !item.time) continue;
    const minute = parseHhmm(item.time);
    const current = map.get(minute);
    if (current?.status === 'accepted') continue;
    if (item.status === 'accepted' || item.status === 'requested') {
      map.set(minute, { status: item.status, key: item.key, id: item.id });
    }
  }
  return map;
}

// The state of one slot, in the order a person needs to know it: booked, requested, past, open, closed.
export function slotStateOf({ open, past, consult }) {
  if (consult?.status === 'accepted') return 'booked';
  if (consult?.status === 'requested') return 'requested';
  if (past) return 'past';
  return open ? 'open' : 'closed';
}

export const hasOutsideOpen = (slots, weekday) => openMinutes(slots, weekday).some(outsideCore);

export { DEFAULT_START, DEFAULT_END };

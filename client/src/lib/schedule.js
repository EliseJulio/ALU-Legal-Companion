// The one list the Calendar page draws: consultations and matter deadlines as items.
// No React here so it can be tested on its own.
// Every date is a 'YYYY-MM-DD' string and every sum is done in UTC so a Kigali deadline never shifts a day.
// A booking's day is the reader's own day as lib/appointments reads it.
// Nothing here names anyone the page does not already show.
import { ACCEPTED, REQUESTED, PAST, DECLINED, bookingState, localDay, timeOf, roomFor } from '@/lib/appointments';
import {
  LATE, SOON, LATER, MONTH_NAMES, deadlineState, weekOf, monthOf, isoDate, daysInMonth,
  chipStateOf, STATE_WORDS,
} from '@/lib/calendar';

const DAY = 86400000;

const CONSULT_MARK = {
  [ACCEPTED]: 'accepted',
  [REQUESTED]: 'requested',
  [PAST]: 'past',
  [DECLINED]: 'past',
  other: 'unknown',
};
const DEADLINE_MARK = { [LATE]: 'late', [SOON]: 'soon', [LATER]: 'later' };

// The key under the calendar. Each entry has its circle (see scheduleStyle.js) and its words.
export const LEGEND = [
  { mark: 'accepted', words: 'Accepted' },
  { mark: 'requested', words: 'Requested, waiting for the lawyer' },
  { mark: 'late', words: 'Late' },
  { mark: 'soon', words: 'Due soon, within 7 days' },
  { mark: 'later', words: 'Later' },
  { mark: 'past', words: 'Past or declined' },
];

// A consultation as an item. Null for a booking whose time cannot be read: it has no day to sit on.
export function consultItem(booking, now = new Date()) {
  const date = localDay(booking.slot);
  if (!date) return null;
  const s = bookingState(booking, now);
  return {
    key: `consult-${booking.id}`,
    kind: 'consult',
    id: booking.id,
    date,
    time: timeOf(booking.slot),
    mark: CONSULT_MARK[s.state] ?? 'unknown',
    word: s.word,
    title: booking.provider_name || 'Consultation',
    sub: booking.topic ? `About: ${booking.topic}` : 'Consultation',
    status: booking.status,
    room: roomFor(booking),
  };
}

// The circle for each state a consultation can be in on a lawyer's or an admin's calendar.
const STATE_MARK = { accepted: 'accepted', requested: 'requested', past: 'past', declined: 'past' };

// The key under a calendar of consultations only. The lawyer's and the admin's calendars use it.
export const CONSULT_LEGEND = [
  { mark: 'accepted', words: 'Accepted' },
  { mark: 'requested', words: 'Requested' },
  { mark: 'past', words: 'Past, declined or completed' },
];

// A consultation on the lawyer's calendar. The title is the topic. The
// requester is not put in the item: the row reads it from the booking, exactly as the server sent it.
// A request whose time has gone reads Past, so it is never taken as one still to answer.
export function expertItem(booking, now = new Date()) {
  const date = localDay(booking.slot);
  if (!date) return null;
  const state = chipStateOf(booking, now);
  return {
    key: `consult-${booking.id}`,
    kind: 'consult',
    id: booking.id,
    date,
    time: timeOf(booking.slot),
    mark: STATE_MARK[state] ?? 'past',
    word: booking.status === 'completed' ? 'Completed' : STATE_WORDS[state],
    title: booking.topic || 'Consultation',
    sub: '',
    status: booking.status,
    booking,
  };
}

// A consultation on the admin's calendar. It carries the provider's name and no requester: the
// admin's list does not have one.
export function adminItem(row, now = new Date()) {
  const date = localDay(row.slot);
  if (!date) return null;
  const state = chipStateOf(row, now);
  return {
    key: `consult-${row.id}`,
    kind: 'consult',
    id: row.id,
    date,
    time: timeOf(row.slot),
    mark: STATE_MARK[state] ?? 'past',
    word: STATE_WORDS[state],
    title: row.provider_name || 'Provider',
    sub: '',
    status: row.status,
  };
}

// Every consultation of a lawyer in order. Bookings with no date are left off.
export function expertItems(bookings = [], now = new Date()) {
  return bookings.map((b) => expertItem(b, now)).filter(Boolean).sort(byWhen);
}

// Every consultation across the directory for the admin in order.
export function adminItems(rows = [], now = new Date()) {
  return rows.map((r) => adminItem(r, now)).filter(Boolean).sort(byWhen);
}

// A matter deadline as an item. Only an open matter with a readable deadline has a day. A finished
// matter's deadline is no longer one to meet.
export function matterItem(matter, today = new Date()) {
  if (matter.status !== 'open') return null;
  const s = deadlineState(matter.next_due, today);
  if (!s) return null;
  return {
    key: `matter-${matter.id}`,
    kind: 'matter',
    id: matter.id,
    date: matter.next_due,
    time: null,
    mark: DEADLINE_MARK[s.state],
    word: s.word,
    title: matter.title,
    sub: matter.next_action || 'No next step recorded',
    status: matter.status,
    href: `/matters/${matter.id}`,
  };
}

// Timed items come before untimed ones on a day. Then consultations come before deadlines, then A to Z.
function byWhen(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
  if (a.time) return -1;
  if (b.time) return 1;
  if (a.kind !== b.kind) return a.kind === 'consult' ? -1 : 1;
  return a.title.localeCompare(b.title);
}

// The whole schedule, in order. Bookings and deadlines in one list.
export function buildItems(bookings = [], matters = [], now = new Date()) {
  const items = [
    ...bookings.map((b) => consultItem(b, now)),
    ...matters.map((m) => matterItem(m, now)),
  ].filter(Boolean);
  return items.sort(byWhen);
}

// How many open matters have no readable deadline, so the page can say they are not on the calendar.
export function undatedOpenCount(matters = [], today = new Date()) {
  return matters.filter((m) => m.status === 'open' && deadlineState(m.next_due, today) === null).length;
}

const parts = (iso) => iso.split('-').map(Number);
const utcOf = (iso) => {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms) => {
  const d = new Date(ms);
  return isoDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

// The day a number of days from `iso`, as 'YYYY-MM-DD'.
export function addDays(iso, n) {
  return fromUtc(utcOf(iso) + n * DAY);
}

// The same day of the month, a number of months on. A day the month does not have goes to its last day.
export function addMonths(iso, n) {
  const [y, m, d] = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return isoDate(year, month, Math.min(d, daysInMonth(year, month)));
}

// The weeks shown for a month, Monday first. Each week is seven 'YYYY-MM-DD' days. The days before
// the 1st and after the last belong to the neighbouring months, so a grid is never ragged.
export function monthDays(year, month) {
  const start = weekOf(isoDate(year, month, 1))[0];
  const end = weekOf(isoDate(year, month, daysInMonth(year, month)))[6];
  const days = [];
  for (let iso = start; iso <= end; iso = addDays(iso, 1)) days.push(iso);
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

// "2 to 8 November 2026" or "26 October to 1 November 2026" across two months.
export function weekTitle(iso) {
  const week = weekOf(iso);
  const [ya, ma, da] = parts(week[0]);
  const [yb, mb, db] = parts(week[6]);
  const name = (m) => MONTH_NAMES[m - 1];
  if (ma === mb) return `${da} to ${db} ${name(mb)} ${yb}`;
  if (ya === yb) return `${da} ${name(ma)} to ${db} ${name(mb)} ${yb}`;
  return `${da} ${name(ma)} ${ya} to ${db} ${name(mb)} ${yb}`;
}

// "Thursday 5 November". Read in UTC, so the day is the day written in the date.
export function longDay(iso) {
  return new Date(utcOf(iso)).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

// "Thu 5 Nov" for an agenda heading.
export function shortWeekDay(iso) {
  return new Date(utcOf(iso)).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

// The first item after a day or undefined when nothing is left. The list is in order so this is the earliest.
export function nextAfter(items, iso) {
  return items.find((item) => item.date > iso);
}

// The days of one month that have an item, in date order.
export function agendaDays(items, year, month) {
  const days = new Set();
  for (const item of items) {
    const at = monthOf(item.date);
    if (at && at.year === year && at.month === month) days.add(item.date);
  }
  return [...days].sort();
}

// The label of a day button. It names the day and the count and the state so a screen reader hears all of it.
export function dayAria(iso, count, { isToday, selected }) {
  const words = [
    longDay(iso),
    count === 0 ? 'nothing on it' : `${count} ${count === 1 ? 'item' : 'items'}`,
  ];
  if (selected) words.push('selected');
  if (isToday) words.push('today');
  return words.join(', ');
}

// The label of a chip: its state word and time and title in the order they are drawn.
// So the name contains the visible text (WCAG 2.5.3). Then its day in full.
// The chip itself truncates the text with an ellipsis. This is the whole of it.
export function chipAria(item) {
  const when = item.time ? ` ${item.time}` : '';
  return `${item.word}${when} ${item.title}, ${longDay(item.date)}`;
}

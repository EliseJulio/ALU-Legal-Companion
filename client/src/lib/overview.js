// The arithmetic behind the three overview pages (Home and the lawyer Overview and the admin Overview).
// Each rule is a plain function with no request in it so it can be tested without a server.
// Every figure a page shows is worked out here from rows an endpoint already sent.
import { daysUntil, dueInWords, readableDay, todayIso } from '@/lib/dates';
import { readableSlot } from '@/lib/bookings';

// A deadline this close or closer needs the person now. The matters list uses the same number.
export const URGENT_DAYS = 7;
// The strip under the 30-day bar. The bar shows the last 30 days before a deadline.
export const BAR_DAYS = 30;
// The lawyer's and admin's "recent" windows.
export const RECENT_DAYS = 30;

// "1 day" and "2 days". It is passed the word for one and the word for many when needed.
export const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

// One figure of a strip. It reads its value only when every request it depends on has answered.
// A failed request shows "Not available" and a waiting one "Loading", so a partial answer is never
// presented as a whole one and a missing answer is never shown as a zero. `sources` are useApi results.
export function figureOf(label, sources, value) {
  if (sources.some((s) => s.error)) return { label, state: 'error' };
  if (sources.some((s) => s.loading || s.data === null)) return { label, state: 'loading' };
  return { label, state: 'ready', ...value };
}

// The first word of a name. "Elise Julio Hakizimana" greets as "Elise". An empty name greets nobody.
export function firstName(user) {
  return String(user?.name ?? '').trim().split(/\s+/)[0] ?? '';
}

export function greeting(user) {
  const name = firstName(user);
  return name ? `Welcome back, ${name}` : 'Welcome back';
}

// ------------------------------------------------------------------ student: matters

// Open matters only, in the order the server sent them (soonest deadline first).
export const openMatters = (matters) => (matters ?? []).filter((m) => m.status === 'open');

// Days from today to a matter's deadline. Negative means it has passed. Null means no deadline.
export function daysLeft(matter, today = new Date()) {
  return daysUntil(matter?.next_due ?? '', today);
}

// The document figures of one matter read from a /matters/progress row.
// A matter with no checklist or one whose checklist is being checked again has no figures. The caller says so in words.
export function documentFigures(row) {
  if (!row || !row.checklist || row.checklist.under_review || typeof row.needed !== 'number') return null;
  return {
    needed: row.needed,
    checked: row.complete,
    waiting: row.awaiting,
    toFix: row.to_fix,
    missing: row.missing,
    expired: row.expired,
    ready: row.ready,
  };
}

// Needs the person now: the deadline is close or passed or a document must be fixed or has expired.
export function needsYou(matter, row, today = new Date()) {
  const left = daysLeft(matter, today);
  if (left !== null && left <= URGENT_DAYS) return true;
  const docs = documentFigures(row);
  return Boolean(docs && (docs.toFix > 0 || docs.expired > 0));
}

// The status word of a matter. Urgent words are solid, in progress is outlined and checked is soft.
// The word is always shown, so the status never depends on colour alone.
export function matterStatus(matter, row, today = new Date()) {
  const left = daysLeft(matter, today);
  if (left !== null && left < 0) return { word: 'Late', tone: 'urgent' };
  if (left === 0) return { word: 'Due today', tone: 'urgent' };
  if (left !== null && left <= URGENT_DAYS) return { word: `Due in ${left} ${plural(left, 'day')}`, tone: 'urgent' };
  const docs = documentFigures(row);
  if (docs?.ready) return { word: 'Checked', tone: 'checked' };
  if (docs && (docs.toFix > 0 || docs.expired > 0)) return { word: 'Needs fixing', tone: 'progress' };
  return { word: 'In progress', tone: 'progress' };
}

// The deadline as words, for the big figure and the table.
export function deadlineWords(left) {
  if (left === null) return 'No deadline set';
  if (left < 0) return `Late by ${-left} ${plural(-left, 'day')}`;
  if (left === 0) return 'Due today';
  return `${left} ${plural(left, 'day')} left`;
}

// A matter's deadline as one sentence part. It is the same on Home and the matter page and the lawyer's list.
// A passed deadline says "Late by N days" and never "N days ago".
// `late` is true only for an open matter because a finished matter has nothing left to be late for.
export function matterDeadline(due, status = 'open', today = new Date()) {
  const left = daysUntil(due ?? '', today);
  if (left === null) return null;
  const late = left < 0 && status === 'open';
  // A finished matter keeps the plain "N days ago"; only an open one is called late.
  const words = late ? deadlineWords(left) : dueInWords(due, today);
  return { day: readableDay(due), words, late };
}

// The deadline figure: a number and its small unit, so a passed deadline reads "13 days late" and
// never a minus sign. `left` is the days from today (negative when passed).
export function deadlineFigure(left, due) {
  const note = readableDay(due) ?? '';
  if (left < 0) return { value: String(-left), unit: `${plural(-left, 'day')} late`, note };
  if (left === 0) return { value: 'Today', unit: '', note };
  return { value: String(left), unit: `${plural(left, 'day')} left`, note };
}

// Where each cell of the 30-day bar stands. The bar is the 30 days before the deadline with one cell a day and the due day last.
// The cells for the days still to come are 'left'. The seven days before those are 'close'.
// Everything earlier is 'passed'. Outside the 30 days the bar is 'none' and the words say why.
export function deadlineCells(left) {
  const outside = left === null || left < 0 || left > BAR_DAYS;
  const ahead = Math.max(left ?? 0, 1);
  return Array.from({ length: BAR_DAYS }, (_, i) => {
    if (outside) return 'none';
    const before = BAR_DAYS - 1 - i; // 0 is the due day
    if (before < ahead) return 'left';
    if (before < ahead + URGENT_DAYS) return 'close';
    return 'passed';
  });
}

// Whole days from one 'YYYY-MM-DD' to another. UTC arithmetic only, so a Kigali date never shifts a day.
function daysBetween(from, to) {
  const at = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((at(to) - at(from)) / 86400000);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The short form of a 'YYYY-MM-DD' date, such as "8 Oct".
function shortDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// The words under the 30-day bar. A matter does not store the day it started.
// So the day it was opened on this site (created_at as a UTC date) is used.
// `total` is the days from then to the due date. `day` is how many have gone by. It is kept between 0 and `total`.
// With no due date or a due date before the opened day there is no count. Only the opened day is given.
export function barSpan(matter, today = new Date()) {
  const opened = String(matter?.created_at ?? '').slice(0, 10);
  if (!DATE_RE.test(opened)) return null;
  const out = { opened, openedWords: shortDay(opened), day: null, total: null };
  const due = matter?.next_due ?? '';
  if (!DATE_RE.test(due)) return out;
  const total = daysBetween(opened, due);
  if (total <= 0) return out;
  const elapsed = daysBetween(opened, todayIso(today));
  return { ...out, total, day: Math.min(Math.max(elapsed, 0), total) };
}

// The reminder for a matter. Pending ones come first (the next to go out), then the rest.
// The reminders endpoint sends the newest first, so the order is set here.
export function reminderFor(reminders, matterId, today = new Date()) {
  const mine = (reminders ?? []).filter((r) => r.matter_id === matterId);
  const pending = mine.filter((r) => r.status === 'pending').sort((a, b) => (a.send_on < b.send_on ? -1 : 1));
  const next = pending[0];
  if (next) {
    const before = daysUntil(next.due_on, today) - daysUntil(next.send_on, today);
    return { kind: 'pending', send_on: next.send_on, before };
  }
  if (mine.some((r) => r.status === 'sent')) return { kind: 'sent' };
  return { kind: 'none' };
}

// The student's figures for the top strip.
export function studentFigures({ matters, progress, bookings, bookmarks }, now = new Date()) {
  const open = openMatters(matters);
  const shared = open.filter((m) => m.shared_with_name).length;
  const rowOf = (m) => (progress ?? []).find((p) => p.id === m.id);
  const attention = open.filter((m) => needsYou(m, rowOf(m), now)).length;
  const withDeadline = open.find((m) => m.next_due && daysLeft(m, now) !== null);
  const soonest = withDeadline ? daysLeft(withDeadline, now) : null;

  const upcoming = (bookings ?? [])
    .filter((b) => (b.status === 'requested' || b.status === 'accepted') && new Date(b.slot).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.slot) - new Date(b.slot));
  const weekAgo = now.getTime() - 7 * 86400000;
  const savedThisWeek = (bookmarks ?? []).filter((g) => new Date(g.bookmarked_at).getTime() >= weekAgo).length;

  return {
    open: { value: open.length, note: shared ? `${shared} shared with a lawyer` : 'Not shared with anyone' },
    attention: {
      value: attention,
      note: attention === 0 ? 'Nothing is close or waiting for a fix' : 'Close deadline or a document to fix',
    },
    deadline: soonest === null
      ? { value: 'None', note: 'No open matter has a deadline' }
      : deadlineFigure(soonest, withDeadline.next_due),
    appointments: {
      value: upcoming.length,
      note: upcoming[0] ? readableSlot(upcoming[0].slot) : 'None booked',
    },
    saved: {
      value: (bookmarks ?? []).length,
      note: savedThisWeek ? `${savedThisWeek} saved this week` : 'Saved guides to read later',
    },
  };
}

// The sentence under the greeting, computed from the attention count.
export function attentionSentence(count) {
  if (count === 0) return 'Nothing needs you this week.';
  if (count === 1) return 'One matter needs you this week.';
  return `${count} matters need you this week.`;
}

// Which matter the documents card opens on: the first with a checklist, else the first open matter.
export function defaultMatterId(progress) {
  const rows = progress ?? [];
  return (rows.find((p) => p.checklist) ?? rows[0])?.id ?? null;
}

// ------------------------------------------------------------------ lawyer

// The words for a booking's requester. Only the fixed words are ever shown. The server may still send
// a name or an anonymous token in this field, so anything anonymous is shown as the one neutral label
// and anything else as "Signed-in requester". No name and no token reaches the screen.
export function requesterWords(requester) {
  return /anonymous/i.test(String(requester ?? '')) ? 'Anonymous requester' : 'Signed-in requester';
}

// Monday 00:00 to the next Monday 00:00 in the reader's own zone.
export function weekBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

const inWeek = (iso, now) => {
  const t = new Date(iso).getTime();
  const { start, end } = weekBounds(now);
  return !Number.isNaN(t) && t >= start.getTime() && t < end.getTime();
};

// The questions waiting. The server sends them oldest first, so the first is the oldest.
export function questionFigures(questions) {
  const list = questions ?? [];
  return { count: list.length, oldest: list[0]?.created_at ?? null };
}

// The booking requests and this week's appointments. A requested booking is a request. An accepted one
// is an appointment. Both counts are from the same list so they cannot disagree.
export function bookingFigures(bookings, now = new Date()) {
  const list = bookings ?? [];
  const requested = list.filter((b) => b.status === 'requested').sort((a, b) => new Date(a.slot) - new Date(b.slot));
  const week = list.filter((b) => (b.status === 'requested' || b.status === 'accepted') && inWeek(b.slot, now));
  return {
    requested: requested.length,
    nextRequest: requested[0] ?? null,
    thisWeek: week.length,
    acceptedThisWeek: week.filter((b) => b.status === 'accepted').length,
  };
}

// Documents waiting for the lawyer's check across the shared matters.
export function sharedFigures(shared) {
  const list = shared ?? [];
  const withDocs = list.filter((m) => m.documents_waiting > 0);
  return {
    documents: list.reduce((sum, m) => sum + (m.documents_waiting ?? 0), 0),
    matters: withDocs.length,
  };
}

// The "Needs you" rows for a lawyer in the order they should be answered: questions then requests then shared matters with documents waiting.
// Each list is capped so the card stays short.
export function needsRows({ questions, bookings, shared }, limit = 3) {
  return {
    questions: (questions ?? []).slice(0, limit),
    requests: (bookings ?? []).filter((b) => b.status === 'requested').sort((a, b) => new Date(a.slot) - new Date(b.slot)).slice(0, limit),
    matters: (shared ?? []).filter((m) => m.documents_waiting > 0).slice(0, limit),
  };
}

// ------------------------------------------------------------------ admin

// Consultations scheduled this week for the admin's card: requested or accepted, from Monday to Sunday.
// The list has the office, the time and the state only.
export function weekScheduled(bookings, now = new Date()) {
  return (bookings ?? []).filter((b) => (b.status === 'requested' || b.status === 'accepted') && inWeek(b.slot, now)).length;
}

// A round top for the axis: four equal steps of 1 or 2 or 5 or 10 times a power of ten.
export function niceTop(max) {
  if (max <= 4) return 4;
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((v) => v >= raw);
  return step * 4;
}

// Guides still being written. The admin writes and publishes, so a guide that is not published is a
// draft. This folds the two unpublished states into one word.
export function unpublishedGuides(guides) {
  return (guides?.draft ?? 0) + (guides?.pending_review ?? 0);
}

// Directory entries checked in the last 30 days, out of the published ones.
export function checkedEntries(providers, now = new Date()) {
  const published = (providers ?? []).filter((p) => p.status === 'published');
  const checked = published.filter((p) => {
    const ago = daysUntil(p.last_checked_at ?? '', now);
    return ago !== null && ago >= -RECENT_DAYS;
  });
  return { checked: checked.length, total: published.length };
}

// Share of reminders that went out, all time. Late sends count as sent. A reminder not sent in time is
// the other half. There is no 30-day count on the server, so none is claimed here.
export function reminderDelivery(reminders) {
  const sent = reminders?.sent ?? 0;
  const missed = reminders?.missed ?? 0;
  const total = sent + missed;
  return { percent: total === 0 ? null : Math.round((sent / total) * 100), missed };
}

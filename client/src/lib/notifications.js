import { apiGet } from '@/lib/api';
import { canOwnActivity, hasRole } from '@/lib/auth';
import { readableDay } from '@/lib/dates';

// The bell lists what the app already tells a person.
// A student sees reminders and accepted appointments and answered questions and checked documents.
// A legal expert sees requests and questions and files waiting for them.
// No endpoint was added for it. Every item comes from a list the person can already read.
// An admin has no list of this kind so the bell is empty for them.

// Matters whose history is read for checked documents. More than this is slow for a bell.
const MAX_MATTERS_CHECKED = 10;
// How many read items are remembered per person. The oldest are forgotten first.
const MAX_READ_KEPT = 200;
// The server writes a lawyer's check as "Checked “<item>”: <result>" (matterDocuments.js).
const CHECKED = /^Checked “/;

const readKey = (userId) => `alc.read.${userId}`;
const day = (iso) => readableDay(iso) ?? iso;

function truncate(text, length = 90) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

// The read items of one person, kept on this device. Blocked storage means nothing is kept and
// the page still works for the time it is open.
export function readIds(userId) {
  try {
    const list = JSON.parse(localStorage.getItem(readKey(userId)) ?? '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveReadIds(userId, ids) {
  try {
    localStorage.setItem(readKey(userId), JSON.stringify(ids.slice(-MAX_READ_KEPT)));
  } catch {
    // Blocked storage. The items read in this visit stay read until the page is closed.
  }
}

// Each item has an id (stable so a read item stays read) and a title and a line of text.
// It also has the page it opens and `at`. That is the time it happened when the server gives one.

// A reminder that was sent or the next one that is waiting.
export function reminderItems(rows) {
  return rows.map((r) => (r.status === 'sent'
    ? {
      id: `sent-${r.id}`,
      title: 'Deadline reminder sent',
      text: `${r.title}. The deadline is ${day(r.due_on)}. We also emailed you.`,
      to: `/matters/${r.matter_id}`,
      at: r.sent_at ?? null,
    }
    : {
      id: `next-${r.id}`,
      title: `Next reminder: ${day(r.send_on)}`,
      text: `${r.title}. The deadline is ${day(r.due_on)}.`,
      to: `/matters/${r.matter_id}`,
      at: null,
    }));
}

export function bookingItems(rows) {
  return rows
    .filter((b) => b.status === 'accepted')
    .map((b) => ({
      id: `booking-${b.id}`,
      title: 'Appointment accepted',
      text: `${b.provider_name}. Open My activity for the details.`,
      to: '/my-activity',
      at: null,
    }));
}

export function questionItems(rows) {
  return rows
    .filter((q) => q.status === 'answered')
    .map((q) => ({
      id: `question-${q.id}`,
      title: 'Your question was answered',
      text: truncate(q.text),
      to: '/my-activity',
      at: q.created_at ?? null,
    }));
}

// The lawyer's checks in one matter's history. Notes the owner wrote are not checks.
export function checkItems(matter) {
  return (matter.events ?? [])
    .filter((e) => !e.author_is_owner && CHECKED.test(e.description))
    .map((e) => ({
      id: `check-${e.id}`,
      title: 'A lawyer checked a document',
      text: `${matter.title}. ${e.description}.`,
      to: `/matters/${matter.id}`,
      at: e.created_at ?? null,
    }));
}

// A consultation that is waiting for the expert to accept or decline it. The requester is not
// named here. The Calendar is where the expert sees who asked.
export function requestItems(rows) {
  return rows
    .filter((b) => b.status === 'requested')
    .map((b) => ({
      id: `request-${b.id}`,
      title: 'A consultation was requested',
      text: 'Open the calendar to accept or decline it.',
      to: '/expert/calendar',
      at: b.created_at ?? null,
    }));
}

export function openQuestionItems(rows) {
  return rows.map((q) => ({
    id: `open-${q.id}`,
    title: 'A question is waiting for an answer',
    text: truncate(q.text),
    to: '/expert/questions',
    at: q.created_at ?? null,
  }));
}

// Shared matters with files to check. The count is in the id, so a new file makes it unread again.
export function waitingItems(rows) {
  return rows
    .filter((m) => m.documents_waiting > 0)
    .map((m) => {
      const n = m.documents_waiting;
      return {
        id: `waiting-${m.id}-${n}`,
        title: 'Documents are waiting for your check',
        text: `${m.title}: ${n} ${n === 1 ? 'document' : 'documents'} to check.`,
        to: `/matters/${m.id}`,
        at: m.updated_at ?? null,
      };
    });
}

// Dated items first, newest first. Items with no time keep the order the sources gave them.
export function sortItems(items) {
  const dated = items.filter((i) => i.at).sort((a, b) => b.at.localeCompare(a.at));
  return [...dated, ...items.filter((i) => !i.at)];
}

// Every source answers { items, failed }. A failed source is not an error for the others.
async function checkSource() {
  const matters = await apiGet('/matters');
  const open = matters.filter((m) => m.status === 'open').slice(0, MAX_MATTERS_CHECKED);
  const results = await Promise.all(open.map((m) => apiGet(`/matters/${m.id}`).then(
    (detail) => ({ ok: true, detail }),
    () => ({ ok: false }),
  )));
  return {
    items: results.filter((r) => r.ok).flatMap((r) => checkItems(r.detail)),
    failed: results.some((r) => !r.ok),
  };
}

// Each source is one request (or several for the checks) turned into { items, failed }.
function studentSources() {
  return [
    () => apiGet('/matters/reminders').then((rows) => ({ items: reminderItems(rows), failed: false })),
    () => apiGet('/bookings/mine').then((rows) => ({ items: bookingItems(rows), failed: false })),
    () => apiGet('/questions/mine').then((rows) => ({ items: questionItems(rows), failed: false })),
    checkSource,
  ];
}

function expertSources() {
  return [
    () => apiGet('/matters/shared').then((rows) => ({ items: waitingItems(rows), failed: false })),
    () => apiGet('/bookings/expert').then((rows) => ({ items: requestItems(rows), failed: false })),
    () => apiGet('/questions/open').then((rows) => ({ items: openQuestionItems(rows), failed: false })),
  ];
}

// The sources for this role. A visitor has none. An admin has none.
export function sourcesFor(who) {
  if (canOwnActivity(who)) return studentSources();
  if (hasRole(who, ['legal_expert'])) return expertSources();
  return [];
}

// Loads every source. The bell shows what could be loaded and says so when something could not
// be. It fails only when every source fails.
export async function loadNotifications(who) {
  const sources = sourcesFor(who);
  if (sources.length === 0) return { items: [], partial: false };
  const results = await Promise.all(sources.map((source) => source().then(
    (value) => ({ ok: true, ...value }),
    (error) => ({ ok: false, error }),
  )));
  const loaded = results.filter((r) => r.ok);
  if (loaded.length === 0) throw results[0].error;
  return {
    items: sortItems(loaded.flatMap((r) => r.items)),
    partial: loaded.length < results.length || loaded.some((r) => r.failed),
  };
}

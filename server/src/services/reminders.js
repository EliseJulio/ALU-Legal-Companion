// Deadline reminders. They are advice only: the deadline stays the user's responsibility.
// Every reminder ends as sent, missed or cancelled and one is never sent after its date.
import { q } from '../db.js';
import { sendMail } from './mailer.js';

// Rwanda is UTC+2 all year. "Today" for a deadline is today in Kigali, not on the server clock.
export function kigaliToday(now = new Date()) {
  return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Days before the deadline when a reminder goes out.
export const REMINDER_OFFSETS = [7, 1];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Replaces a matter's pending reminders with a new set for nextDue. Call it when the deadline
// is set, changed or cleared or when the matter is closed (nextDue = null).
// Old reminders are cancelled not deleted so the evaluation can still count them.
// A send date already in the past moves to today. Two on the same day become one.
export async function scheduleReminders(matterId, nextDue, today = kigaliToday()) {
  await q(`UPDATE reminders SET status = 'cancelled' WHERE matter_id = $1 AND status = 'pending'`, [matterId]);
  if (!nextDue || nextDue < today) return [];
  const sendDates = [...new Set(REMINDER_OFFSETS.map((n) => {
    const d = addDays(nextDue, -n);
    return d < today ? today : d;
  }))];
  const rows = [];
  for (const sendOn of sendDates) {
    const [row] = await q(
      `INSERT INTO reminders (matter_id, due_on, send_on) VALUES ($1,$2,$3) RETURNING *`,
      [matterId, nextDue, sendOn]);
    rows.push(row);
  }
  return rows;
}

const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');

// The email gives the date, never the matter title. A title like "harassment by my supervisor"
// should not show in an inbox someone else may see.
function reminderText(name, dueOn, daysLeft) {
  const when = daysLeft <= 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
  return [
    `Hello ${name},`,
    '',
    `A deadline you recorded on ALU Legal Companion is ${when}, on ${dueOn}.`,
    `Sign in to see which matter it is and what you planned to do: ${appUrl()}/matters`,
    '',
    'This reminder is a courtesy. Meeting the deadline remains your responsibility, and if you',
    'are unsure what it requires, the Access to Justice Bureau of your district gives free advice.',
    '',
    'Legal information, not legal advice.',
  ].join('\n');
}

// One pass of the scheduler. It is safe to run as often as you like: a reminder leaves
// "pending" only once.
export async function runDueReminders(today = kigaliToday()) {
  // Reminders whose deadline has passed are marked missed and never sent.
  const missed = await q(
    `UPDATE reminders SET status = 'missed' WHERE status = 'pending' AND due_on < $1 RETURNING id`,
    [today]);

  const due = await q(
    `SELECT r.id, r.due_on, u.email, u.name, m.status AS matter_status
       FROM reminders r
       JOIN matters m ON m.id = r.matter_id
       JOIN users u   ON u.id = m.user_id
      WHERE r.status = 'pending' AND r.send_on <= $1
      ORDER BY r.send_on, r.id`,
    [today]);

  let sent = 0;
  let failed = 0;
  let cancelled = 0;
  for (const r of due) {
    if (r.matter_status !== 'open') {
      await q(`UPDATE reminders SET status = 'cancelled' WHERE id = $1 AND status = 'pending'`, [r.id]);
      cancelled += 1;
      continue;
    }
    const daysLeft = Math.round((new Date(`${r.due_on}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000);
    try {
      await sendMail({ to: r.email, subject: 'A deadline you recorded is coming up', text: reminderText(r.name, r.due_on, daysLeft) });
      await q(`UPDATE reminders SET status = 'sent', sent_at = now() WHERE id = $1 AND status = 'pending'`, [r.id]);
      sent += 1;
    } catch (err) {
      // It stays pending, so the next pass tries again. Past the deadline it becomes missed.
      // The log does not include the address.
      console.error('[reminders] send failed', { reminder: r.id, error: err.code || err.name });
      failed += 1;
    }
  }
  return { sent, failed, cancelled, missed: missed.length };
}

// Delivery counts for the evaluation.
export async function reminderSummary() {
  const [row] = await q(
    `SELECT count(*) FILTER (WHERE status = 'sent')::int      AS sent,
            count(*) FILTER (WHERE status = 'missed')::int    AS missed,
            count(*) FILTER (WHERE status = 'pending')::int   AS pending,
            count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
            count(*) FILTER (WHERE status = 'sent' AND (sent_at AT TIME ZONE 'Africa/Kigali')::date > due_on)::int AS sent_late
       FROM reminders`);
  return row;
}

// Started by index.js. Once an hour is enough for deadlines counted in days. The timer is
// unref'd so it never keeps the process alive on its own.
export function startReminderScheduler({ everyMs = 60 * 60 * 1000 } = {}) {
  const tick = () => runDueReminders()
    .then((r) => { if (r.sent || r.missed || r.failed) console.log('[reminders]', r); })
    .catch((err) => console.error('[reminders] pass failed', { error: err.code || err.name }));
  tick();
  const handle = setInterval(tick, everyMs);
  handle.unref?.();
  return handle;
}

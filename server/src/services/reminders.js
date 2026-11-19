// Deadline reminders. They are advice only. The deadline stays the person's responsibility.
// Every reminder ends as sent, missed or cancelled. One is never sent after its date.
import { q, pool } from '../db.js';
import { sendMail } from './mailer.js';
import { kigaliToday } from './kigali.js';
import { EMAIL_BUDGET_CODE } from './emailBudget.js';

export { kigaliToday };

// The key of the lock that stops two reminder passes running at once. It is held on one
// connection for the whole pass. Two passes can come from the timer in the server, the job
// endpoint, or two server processes.
export const REMINDER_LOCK_KEY = 4242001;

// How many days before the deadline a reminder goes out.
export const REMINDER_OFFSETS = [7, 1];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// True only for a real calendar date written as YYYY-MM-DD. "2026-02-30" is not one.
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
// is set or changed or cleared or when the matter is closed (nextDue = null).
// Old reminders are cancelled and not deleted so delivery can still be counted.
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
      `INSERT INTO reminders (matter_id, due_on, send_on) VALUES ($1,$2,$3)
       RETURNING id, due_on, send_on, status, sent_at`,
      [matterId, nextDue, sendOn]);
    rows.push(row);
  }
  return rows;
}

const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');

// The email gives the date and never the matter title. A title like "harassment by my
// supervisor" should not show in an inbox that someone else may see.
function reminderText(name, dueOn, daysLeft) {
  const when = daysLeft <= 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
  return [
    `Hello ${name},`,
    '',
    `A deadline you recorded on ALU Legal Companion is ${when}, on ${dueOn}.`,
    `Sign in to see which matter it is and what you planned to do: ${appUrl()}/matters`,
    '',
    'This reminder is a courtesy. Meeting the deadline remains your responsibility.',
    'If you are unsure what it requires, the Access to Justice Bureau of your district gives free advice.',
    '',
    'Legal information not legal advice.',
  ].join('\n');
}

// One pass of the scheduler. It is safe to run as often as you like because a reminder
// leaves "pending" only once. Two passes never run at the same time: when the lock is held
// elsewhere this returns at once with skipped set and sends nothing.
export async function runDueReminders(today = kigaliToday()) {
  const client = await pool.connect();
  let broken = false;
  try {
    const [{ locked }] = (await client.query('SELECT pg_try_advisory_lock($1) AS locked', [REMINDER_LOCK_KEY])).rows;
    if (!locked) return { sent: 0, failed: 0, cancelled: 0, missed: 0, skipped: true };
    try {
      return await runReminderPass(today);
    } finally {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [REMINDER_LOCK_KEY]);
      } catch {
        // The lock could not be let go. The connection is discarded below, which ends the session
        // and with it the lock. A broken connection must not go back into the pool holding it.
        broken = true;
      }
    }
  } finally {
    client.release(broken ? new Error('reminder lock not released') : undefined);
  }
}

async function runReminderPass(today) {
  // Reminders whose deadline has passed are marked missed and never sent.
  const missed = await q(
    `UPDATE reminders SET status = 'missed' WHERE status = 'pending' AND due_on < $1 RETURNING id`,
    [today]);

  const due = await q(
    `SELECT r.id, r.due_on, u.email, u.name, m.status AS matter_status, u.deactivated_at
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
    // A closed matter or a switched-off account gets nothing.
    if (r.matter_status !== 'open' || r.deactivated_at) {
      await q(`UPDATE reminders SET status = 'cancelled' WHERE id = $1 AND status = 'pending'`, [r.id]);
      cancelled += 1;
      continue;
    }
    const daysLeft = Math.round((new Date(`${r.due_on}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000);
    try {
      await sendMail({
        to: r.email,
        subject: 'A deadline you recorded is coming up',
        text: reminderText(r.name, r.due_on, daysLeft),
        optional: true,
      });
      await q(`UPDATE reminders SET status = 'sent', sent_at = now() WHERE id = $1 AND status = 'pending'`, [r.id]);
      sent += 1;
    } catch (err) {
      // The daily budget is used up. Every reminder left stays pending for the next pass.
      if (err.code === EMAIL_BUDGET_CODE) {
        console.log('[reminders] daily email budget reached; the rest wait for the next pass');
        break;
      }
      // It stays pending so the next pass tries again. After the deadline it becomes missed.
      // The log does not include the address.
      console.error('[reminders] send failed', { reminder: r.id, error: err.code || err.name });
      failed += 1;
    }
  }
  return { sent, failed, cancelled, missed: missed.length };
}

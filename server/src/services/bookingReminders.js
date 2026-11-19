// Reminders before a consultation. The lawyer and a signed-in person get one a day ahead and one an
// hour ahead. An anonymous person has no address, so gets none.
//
// A reminder is sent only in time: before the slot starts and within 30 minutes of its send time.
// Anything later is marked missed and not sent. A reminder that could not be sent because the daily
// email budget is used up stays pending for the next run.
//
// The text gives the time and a link. It never gives the topic or a name.
import { q, pool } from '../db.js';
import { sendMail, appUrl } from './mailer.js';
import { EMAIL_BUDGET_CODE } from './emailBudget.js';
import { kigaliDateTime } from './kigali.js';

// The lock that stops two passes sending the same reminder. It is held on one connection for the
// whole pass. It is a different key from the deadline reminders.
export const BOOKING_REMINDER_LOCK_KEY = 4242002;

const HOUR_MS = 60 * 60 * 1000;
const LEAD_MS = { day: 24 * HOUR_MS, hour: HOUR_MS };
const LATE_MS = 30 * 60 * 1000;

// Makes the reminders still to come for a booking. Called when the lawyer accepts it. A reminder
// whose send time has passed is not made. The owner gets reminders only with an active account.
export async function scheduleBookingReminders(bookingId, now = new Date()) {
  const [b] = await q(
    `SELECT b.slot,
            (b.user_id IS NOT NULL AND EXISTS (
               SELECT 1 FROM users u WHERE u.id = b.user_id AND u.deactivated_at IS NULL)) AS owner_active,
            (p.user_id IS NOT NULL) AS has_lawyer
       FROM bookings b JOIN providers p ON p.id = b.provider_id
      WHERE b.id = $1`, [bookingId]);
  if (!b) return 0;
  const recipients = [...(b.has_lawyer ? ['lawyer'] : []), ...(b.owner_active ? ['owner'] : [])];
  const slot = new Date(b.slot).getTime();
  let made = 0;
  for (const recipient of recipients) {
    for (const kind of Object.keys(LEAD_MS)) {
      const sendAt = new Date(slot - LEAD_MS[kind]);
      if (sendAt <= now) continue;
      // A row left from an earlier time is armed again. A row already sent for this same time is kept.
      const rows = await q(
        `INSERT INTO booking_reminders (booking_id, recipient, kind, send_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT (booking_id, recipient, kind) DO UPDATE
            SET send_at = EXCLUDED.send_at, status = 'pending', sent_at = NULL
          WHERE booking_reminders.status = 'cancelled' OR booking_reminders.send_at <> EXCLUDED.send_at
         RETURNING id`,
        [bookingId, recipient, kind, sendAt]);
      made += rows.length;
    }
  }
  return made;
}

// Cancels the reminders still waiting for a booking that was declined, cancelled or completed.
export async function cancelBookingReminders(bookingId) {
  const rows = await q(
    `UPDATE booking_reminders SET status = 'cancelled' WHERE booking_id = $1 AND status = 'pending' RETURNING id`,
    [bookingId]);
  return rows.length;
}

// One pass. It returns counts only. When another pass holds the lock this one does nothing.
export async function runDueBookingReminders(now = new Date()) {
  const client = await pool.connect();
  let broken = false;
  try {
    const [{ locked }] = (await client.query('SELECT pg_try_advisory_lock($1) AS locked', [BOOKING_REMINDER_LOCK_KEY])).rows;
    if (!locked) return { sent: 0, failed: 0, missed: 0, cancelled: 0, skipped: true };
    try {
      return await bookingReminderPass(now);
    } finally {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [BOOKING_REMINDER_LOCK_KEY]);
      } catch {
        // The lock could not be let go. The connection is dropped below so the session, and the lock with it, ends.
        broken = true;
      }
    }
  } finally {
    client.release(broken ? new Error('booking reminder lock not released') : undefined);
  }
}

async function bookingReminderPass(now) {
  // A reminder for a booking that is no longer accepted is cancelled.
  const stale = await q(
    `UPDATE booking_reminders r SET status = 'cancelled' FROM bookings b
      WHERE b.id = r.booking_id AND r.status = 'pending' AND b.status <> 'accepted'
      RETURNING r.id`);
  let cancelled = stale.length;

  // The address of each recipient is read here. A missing or switched-off account gives none.
  const due = await q(
    `SELECT r.id, r.recipient, r.kind, r.send_at, b.slot,
            CASE WHEN r.recipient = 'owner' THEN ou.email ELSE eu.email END AS email
       FROM booking_reminders r
       JOIN bookings b ON b.id = r.booking_id
       JOIN providers p ON p.id = b.provider_id
       LEFT JOIN users ou ON ou.id = b.user_id AND ou.deactivated_at IS NULL
       LEFT JOIN users eu ON eu.id = p.user_id AND eu.deactivated_at IS NULL
      WHERE r.status = 'pending' AND r.send_at <= $1
      ORDER BY r.send_at, r.id`,
    [now]);

  let sent = 0;
  let failed = 0;
  let missed = 0;
  for (const r of due) {
    if (!r.email) {
      await q(`UPDATE booking_reminders SET status = 'cancelled' WHERE id = $1 AND status = 'pending'`, [r.id]);
      cancelled += 1;
      continue;
    }
    if (now.getTime() >= new Date(r.slot).getTime() || now.getTime() - new Date(r.send_at).getTime() > LATE_MS) {
      await q(`UPDATE booking_reminders SET status = 'missed' WHERE id = $1 AND status = 'pending'`, [r.id]);
      missed += 1;
      continue;
    }
    try {
      await sendMail({
        to: r.email,
        subject: r.recipient === 'owner' ? 'Your consultation is coming up' : 'A consultation you accepted is coming up',
        text: reminderText(r),
        optional: true,
      });
      await q(`UPDATE booking_reminders SET status = 'sent', sent_at = now() WHERE id = $1 AND status = 'pending'`, [r.id]);
      sent += 1;
    } catch (err) {
      // Over the daily budget the reminder stays pending. Any other error is logged without the address.
      if (err.code === EMAIL_BUDGET_CODE) continue;
      console.error('[booking-reminders] send failed', { reminder: r.id, error: err.code || err.name });
      failed += 1;
    }
  }
  return { sent, failed, missed, cancelled, skipped: false };
}

// The owner and the lawyer each get the time, when it is, and a link. Nothing else.
function reminderText(r) {
  const when = r.kind === 'day' ? 'in 24 hours' : 'in one hour';
  const link = r.recipient === 'owner' ? `${appUrl()}/appointments` : `${appUrl()}/expert/appointments`;
  return [
    `A consultation on ALU Legal Companion starts ${when}, at ${kigaliDateTime(r.slot)} (Kigali time).`,
    '',
    `Open your appointments: ${link}`,
    '',
    'Legal information, not legal advice.',
  ].join('\n');
}

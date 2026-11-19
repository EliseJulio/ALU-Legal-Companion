// Changes to a consultation. A lawyer can suggest another time for a waiting request. The person
// who asked takes the time or declines it. A person can also move a consultation to another open time.
// Anonymous people use the same actions with their code in the body.
import { Router } from 'express';
import { q, pool } from '../db.js';
import { MAX_OPEN_REQUESTS, MESSAGES } from '../services/bookingHours.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { newTokenLookupLimiter } from '../middleware/rateLimit.js';
import { normalizeAnonToken, hashAnonToken } from '../services/anonToken.js';
import {
  bookingAccepted, proposalSuggested, proposalAnswered, bookingMoved,
} from '../services/notify.js';
import { scheduleBookingReminders, cancelBookingReminders } from '../services/bookingReminders.js';
import {
  bookingInput, requestRefusal, bookingLimiter, BOOKING_COLUMNS,
} from './bookings.js';

const router = Router();
const tokenLimiter = newTokenLookupLimiter();

const ANON_NOT_FOUND = { error: 'No booking found for this token' };
const NOT_FOUND = { error: 'Booking not found (or not yours)' };
const CHANGED = { error: 'That booking was just changed. Reload and try again.' };
// The same columns as a read, without the table prefix, for an UPDATE with no alias.
const RETURNING = BOOKING_COLUMNS.replaceAll('b.', '');

const logReminderError = (err) => console.error('[booking-reminders] could not update', { error: err.code || err.name });

// The time must be a valid slot, and must not be the one already asked for or booked.
// Returns { input } or { error } with the message to send.
async function checkedSlot(body, providerId, currentSlot) {
  const input = bookingInput({ provider_id: providerId, slot: body?.slot });
  if (input.error) return { error: input.error };
  if (currentSlot && new Date(currentSlot).getTime() === input.instant.getTime()) return { same: true };
  const refusal = await requestRefusal(input);
  if (refusal) return { error: refusal };
  return { input };
}

// Lawyer suggests a time for a request. A second suggestion replaces the first.
async function suggest(res, current, body) {
  const checked = await checkedSlot(body, current.provider_id, current.slot);
  if (checked.same) return res.status(400).json({ error: 'That is the time already asked for.' });
  if (checked.error) return res.status(400).json({ error: checked.error });
  const [booking] = await q(
    `UPDATE bookings SET proposed_slot = $1, proposed_at = now()
      WHERE id = $2 AND status = 'requested' RETURNING ${RETURNING}`,
    [checked.input.slot, current.id]);
  if (!booking) return res.status(409).json(CHANGED);
  proposalSuggested(booking.id);
  res.json(booking);
}

// The person takes the suggested time or declines it.
async function answer(res, current, action) {
  if (action !== 'accept' && action !== 'decline') {
    return res.status(400).json({ error: 'action must be accept or decline' });
  }
  if (!current.proposed_slot) return res.status(400).json({ error: 'There is no suggested time to answer.' });
  const slot = new Date(current.proposed_slot).toISOString();

  if (action === 'decline') {
    const [booking] = await q(
      `UPDATE bookings SET proposed_slot = NULL, proposed_at = NULL
        WHERE id = $1 AND status = 'requested' AND proposed_slot IS NOT NULL RETURNING ${RETURNING}`,
      [current.id]);
    if (!booking) return res.status(409).json(CHANGED);
    proposalAnswered(booking.id, slot, false);
    return res.json(booking);
  }

  // The time is checked again. Another booking may have taken it since the lawyer suggested it.
  // The suggestion stays so the lawyer can replace it.
  const refusal = await requestRefusal({ providerId: current.provider_id, instant: new Date(slot) });
  if (refusal) return res.status(400).json({ error: refusal });
  try {
    // The write only goes ahead if the suggestion is still the time that was checked above.
    const [booking] = await q(
      `UPDATE bookings SET slot = $2, proposed_slot = NULL, proposed_at = NULL, status = 'accepted'
        WHERE id = $1 AND status = 'requested' AND proposed_slot = $2 RETURNING ${RETURNING}`,
      [current.id, slot]);
    if (!booking) return res.status(409).json({ error: 'That suggestion was just changed. Reload and look again.' });
    bookingAccepted(booking.id);
    await scheduleBookingReminders(booking.id).catch(logReminderError);
    proposalAnswered(booking.id, booking.slot, true);
    return res.json(booking);
  } catch (err) {
    // A race between the check above and this update. The database allows one accepted booking per time.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That time was just taken. Ask the lawyer for another.' });
    }
    throw err;
  }
}

// Writes the move. An accepted consultation that goes back to waiting becomes an open request, so it is
// counted under the same lock as a new request. Two moves at once cannot both take the last place.
// Returns { capped } when the limit is reached, otherwise { booking } (undefined when nothing matched).
async function saveMove(current, slot) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (current.user_id && current.status === 'accepted') {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`request:${current.user_id}:${current.provider_id}`]);
      const { rows: [{ open }] } = await client.query(
        `SELECT count(*)::int AS open FROM bookings
          WHERE user_id = $1 AND provider_id = $2 AND status = 'requested'`,
        [current.user_id, current.provider_id]);
      if (open >= MAX_OPEN_REQUESTS) {
        await client.query('ROLLBACK');
        return { capped: true };
      }
    }
    const { rows: [booking] } = await client.query(
      `UPDATE bookings SET slot = $1, status = 'requested', proposed_slot = NULL, proposed_at = NULL
        WHERE id = $2 AND status = $3 RETURNING ${RETURNING}`,
      [slot, current.id, current.status]);
    await client.query('COMMIT');
    return { booking };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Moves a consultation that has not started. It waits for the lawyer to accept the new time.
async function move(res, current, body) {
  if (!['requested', 'accepted'].includes(current.status) || new Date(current.slot) <= new Date()) {
    return res.status(400).json({ error: 'This consultation can no longer be moved.' });
  }
  const checked = await checkedSlot(body, current.provider_id, current.slot);
  if (checked.same) return res.status(400).json({ error: 'That is the time you already have.' });
  if (checked.error) return res.status(400).json({ error: checked.error });
  const saved = await saveMove(current, checked.input.slot);
  if (saved.capped) return res.status(400).json({ error: MESSAGES.cap });
  const { booking } = saved;
  if (!booking) return res.status(409).json(CHANGED);
  await cancelBookingReminders(booking.id).catch(logReminderError);
  bookingMoved(booking.id);
  res.json(booking);
}

// Anonymous routes come first so that "anon" is never read as a booking id.
// POST /api/bookings/anon/proposal: the code goes in the body
router.post('/anon/proposal', tokenLimiter, async (req, res) => {
  const token = typeof req.body?.anon_token === 'string' ? normalizeAnonToken(req.body.anon_token) : null;
  if (!token) return res.status(404).json(ANON_NOT_FOUND);
  const [current] = await q(
    'SELECT id, provider_id, proposed_slot FROM bookings WHERE anon_token = $1', [hashAnonToken(token)]);
  if (!current) return res.status(404).json(ANON_NOT_FOUND);
  return answer(res, current, req.body?.action);
});

// POST /api/bookings/anon/reschedule: the code and the new slot go in the body
router.post('/anon/reschedule', tokenLimiter, async (req, res) => {
  const token = typeof req.body?.anon_token === 'string' ? normalizeAnonToken(req.body.anon_token) : null;
  if (!token) return res.status(404).json(ANON_NOT_FOUND);
  const [current] = await q(
    'SELECT id, provider_id, slot, status FROM bookings WHERE anon_token = $1', [hashAnonToken(token)]);
  if (!current) return res.status(404).json(ANON_NOT_FOUND);
  return move(res, current, req.body);
});

// POST /api/bookings/:id/propose: the lawyer whose entry the booking is for. Anyone else gets 404.
router.post('/:id/propose', requireAuth('legal_expert'), requireIntParam('id'), async (req, res) => {
  const [current] = await q(
    `SELECT b.id, b.status, b.slot, b.provider_id FROM bookings b
       JOIN providers p ON p.id = b.provider_id
      WHERE b.id = $1 AND p.user_id = $2`, [req.params.id, req.user.id]);
  if (!current) return res.status(404).json({ error: 'Booking not found (or not yours)' });
  if (current.status !== 'requested') {
    return res.status(400).json({ error: 'Only a waiting request can get a suggested time.' });
  }
  return suggest(res, current, req.body);
});

// POST /api/bookings/:id/proposal: the signed-in person who made the booking
router.post('/:id/proposal', requireAuth('student', 'staff'), requireIntParam('id'), async (req, res) => {
  const [current] = await q(
    'SELECT id, provider_id, proposed_slot FROM bookings WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]);
  if (!current) return res.status(404).json(NOT_FOUND);
  return answer(res, current, req.body?.action);
});

// POST /api/bookings/:id/reschedule: the signed-in person who made the booking. Counts against the
// same limit as a new request.
router.post('/:id/reschedule', requireAuth('student', 'staff'), bookingLimiter, requireIntParam('id'), async (req, res) => {
  const [current] = await q(
    'SELECT id, user_id, provider_id, slot, status FROM bookings WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]);
  if (!current) return res.status(404).json(NOT_FOUND);
  return move(res, current, req.body);
});

export default router;

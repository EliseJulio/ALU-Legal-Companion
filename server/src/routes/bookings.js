// Bookings: a consultation with a lawyer or consultant.
// A signed-in student or staff member books in their own name.
// Anyone can also book anonymously. That booking stores no name and no account. It stores a
// random token that is shown once.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam, isValidId } from '../middleware/validate.js';
import { newSubmitLimiter, newTokenLookupLimiter } from '../middleware/rateLimit.js';
import { makeAnonToken, normalizeAnonToken, hashAnonToken } from '../services/anonToken.js';

const router = Router();

// This route has its own limiters so other routes do not use up its budget.
const anonymousLimiter = newSubmitLimiter();
const tokenLimiter = newTokenLookupLimiter();

// The columns every read returns. The row also has user_id and it is not needed.
const BOOKING_COLUMNS = 'b.id, b.provider_id, b.slot, b.topic, b.status, b.created_at';

// The video room is given out only once the expert has accepted. A requested booking is a
// request and not an appointment. Giving out the link earlier invites somebody to a
// consultation nobody agreed to. Declined and completed bookings get nothing for the same
// reason. The rule is written once here so the three reads cannot drift apart.
const ROOM_WHEN_ACCEPTED = `CASE WHEN b.status = 'accepted' THEN p.meet_link END AS meet_link`;

// A person is only ever sent to a body that somebody checked. So the entry must be
// published as well as bookable. Posting its id directly must not get around that.
async function bookableProvider(id) {
  const [p] = await q(
    `SELECT id FROM providers WHERE id = $1 AND bookable = true AND status = 'published'`, [id]);
  return p;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Checks the body of a booking request. Returns { error } or the clean values.
function bookingInput(body) {
  const { provider_id: providerId, slot, topic } = body || {};
  if (!providerId || !slot) return { error: 'provider_id and slot are required' };
  if (!isValidId(providerId)) return { error: 'provider_id must be a valid id' };
  const when = typeof slot === 'string' ? new Date(slot) : null;
  if (!when || Number.isNaN(when.getTime()) || when <= new Date() || when.getTime() > Date.now() + 365 * DAY_MS) {
    return { error: 'slot must be a date and time in the future within the next year' };
  }
  if (topic !== undefined && topic !== null && (typeof topic !== 'string' || topic.length > 500)) {
    return { error: 'topic must be text of 500 characters or fewer' };
  }
  return { providerId: Number(providerId), slot: when.toISOString(), topic: topic?.trim() || null };
}

const NOT_BOOKABLE = { error: 'This provider does not take online bookings yet' };

// POST /api/bookings: a signed-in student or staff member
router.post('/', requireAuth('student', 'staff'), async (req, res) => {
  const input = bookingInput(req.body);
  if (input.error) return res.status(400).json({ error: input.error });
  if (!(await bookableProvider(input.providerId))) return res.status(400).json(NOT_BOOKABLE);
  const [booking] = await q(
    `INSERT INTO bookings (user_id, provider_id, slot, topic) VALUES ($1,$2,$3,$4)
     RETURNING id, provider_id, slot, topic, status, created_at`,
    [req.user.id, input.providerId, input.slot, input.topic]);
  res.status(201).json(booking);
});

// POST /api/bookings/anonymous: no identity is stored and the token is shown once.
// It ignores any login. Even a signed-in person who uses this route stays anonymous.
router.post('/anonymous', anonymousLimiter, async (req, res) => {
  const input = bookingInput(req.body);
  if (input.error) return res.status(400).json({ error: input.error });
  if (!(await bookableProvider(input.providerId))) return res.status(400).json(NOT_BOOKABLE);
  // The person gets the token. The database keeps only its hash.
  const anonToken = makeAnonToken();
  const [booking] = await q(
    `INSERT INTO bookings (anon_token, provider_id, slot, topic) VALUES ($1,$2,$3,$4)
     RETURNING id, provider_id, slot, topic, status`,
    [hashAnonToken(anonToken), input.providerId, input.slot, input.topic]);
  res.status(201).json({
    ...booking,
    anon_token: anonToken,
    warning: 'Save this token now. It is shown only once and cannot be recovered.',
  });
});

// GET /api/bookings/mine
router.get('/mine', requireAuth('student', 'staff'), async (req, res) => {
  res.json(await q(
    `SELECT ${BOOKING_COLUMNS}, p.name AS provider_name, ${ROOM_WHEN_ACCEPTED}
       FROM bookings b JOIN providers p ON p.id = b.provider_id
      WHERE b.user_id = $1 ORDER BY b.slot DESC`, [req.user.id]));
});

// GET /api/bookings/anon/:token: check the status of an anonymous booking. No login.
// The room belongs to the expert. Giving it to the person who booked reveals nothing about
// who they are. Holding it back would force an anonymous person to identify themselves at
// the last step.
router.get('/anon/:token', tokenLimiter, async (req, res) => {
  const NOT_FOUND = { error: 'No booking found for this token' };
  const token = normalizeAnonToken(req.params.token);
  if (!token) return res.status(404).json(NOT_FOUND);
  const [booking] = await q(
    `SELECT b.id, b.slot, b.topic, b.status, p.name AS provider_name, ${ROOM_WHEN_ACCEPTED}
       FROM bookings b JOIN providers p ON p.id = b.provider_id WHERE b.anon_token = $1`,
    [hashAnonToken(token)]);
  if (!booking) return res.status(404).json(NOT_FOUND);
  res.json(booking);
});

// GET /api/bookings/expert: the bookings for the entry linked to this expert account.
// An anonymous requester is shown as "Anonymous". No part of the token is shown.
router.get('/expert', requireAuth('legal_expert'), async (req, res) => {
  res.json(await q(
    `SELECT ${BOOKING_COLUMNS}, ${ROOM_WHEN_ACCEPTED},
            CASE WHEN b.user_id IS NULL THEN 'Anonymous' ELSE u.name END AS requester
       FROM bookings b
       JOIN providers p ON p.id = b.provider_id AND p.user_id = $1
       LEFT JOIN users u ON u.id = b.user_id
      ORDER BY b.slot ASC`, [req.user.id]));
});

// A booking only moves forward. A finished or declined booking cannot be changed again.
const NEXT_STATUS = { requested: ['accepted', 'declined'], accepted: ['completed', 'declined'] };

// POST /api/bookings/:id/status: the expert accepts, declines or completes their own bookings
router.post('/:id/status', requireAuth('legal_expert'), requireIntParam('id'), async (req, res) => {
  const { status } = req.body || {};
  if (!['accepted', 'declined', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'status must be accepted, declined or completed' });
  }
  const [current] = await q(
    `SELECT b.id, b.status FROM bookings b JOIN providers p ON p.id = b.provider_id
      WHERE b.id = $1 AND p.user_id = $2`, [req.params.id, req.user.id]);
  if (!current) return res.status(404).json({ error: 'Booking not found (or not yours)' });
  if (!NEXT_STATUS[current.status]?.includes(status)) {
    return res.status(400).json({ error: `A booking that is ${current.status} cannot be marked ${status}.` });
  }
  try {
    // The old status is in the WHERE so two changes at once cannot both succeed.
    const [booking] = await q(
      `UPDATE bookings b SET status = $1 WHERE b.id = $2 AND b.status = $3
       RETURNING ${BOOKING_COLUMNS.replaceAll('b.', '')}`,
      [status, current.id, current.status]);
    if (!booking) return res.status(409).json({ error: 'That booking was just changed. Reload and try again.' });
    res.json(booking);
  } catch (err) {
    // The database allows one accepted booking for each provider and time.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You already have an accepted booking at that time.' });
    }
    throw err;
  }
});

export default router;

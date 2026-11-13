// Bookings: a consultation with a lawyer or consultant.
// A signed-in student or staff member books in their own name.
// Anyone can also book anonymously. That booking stores no name and no account. It stores a
// random token that is shown once.
import { Router } from 'express';
import { q, pool } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { requireIntParam, isValidId } from '../middleware/validate.js';
import { newSubmitLimiter, newTokenLookupLimiter } from '../middleware/rateLimit.js';
import { makeAnonToken, normalizeAnonToken, hashAnonToken } from '../services/anonToken.js';
import { bookingAccepted } from '../services/notify.js';
import { dailyAvailable, roomsPerDay, createRoom, createToken, roomUrl } from '../services/dailyRooms.js';
import { callConfigured, roomNameFor, signTicket, signalUrl, iceServers } from '../services/callTickets.js';

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
// An anonymous requester gets a fixed neutral label. No part of the token or its hash is shown.
// The expert acts on a booking by its id, so the label is never needed for that.
router.get('/expert', requireAuth('legal_expert'), async (req, res) => {
  res.json(await q(
    `SELECT ${BOOKING_COLUMNS}, ${ROOM_WHEN_ACCEPTED},
            CASE WHEN b.user_id IS NULL THEN 'Anonymous requester' ELSE u.name END AS requester
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
    // A signed-in person is told by email with the time and the room. A failed send is logged only.
    if (status === 'accepted') bookingAccepted(booking.id);
    res.json(booking);
  } catch (err) {
    // The database allows one accepted booking for each provider and time.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You already have an accepted booking at that time.' });
    }
    throw err;
  }
});

// Joining a call. Each accepted booking gets one private video room, made the first time someone
// joins and then reused. A limit per day stops the free minutes running out.
const joinLimiter = newTokenLookupLimiter();
const DAILY_LOCK = 'daily-rooms';
const NO_ROOM = 'No video room has been set up for this appointment yet.';

// The Google Meet link, only when it is a full https address on meet.google.com.
function meetLinkOf(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && url.hostname === 'meet.google.com' ? url.href : null;
  } catch {
    return null;
  }
}

// Makes the room for a booking or reuses it.
// The booking row is locked while the room is made so two people joining at once share one room.
// The count for the day and the new room are checked under one lock too.
// So two bookings cannot both take the last place in the day. Returns { name } or { reason }.
async function claimRoom(bookingId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [booking] } = await client.query(
      'SELECT room_name FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    if (booking.room_name) {
      await client.query('COMMIT');
      return { name: booking.room_name };
    }
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [DAILY_LOCK]);
    // The day starts at midnight in Kigali, not in UTC.
    const { rows: [{ made }] } = await client.query(
      `SELECT count(*)::int AS made FROM bookings
        WHERE room_created_at >= (date_trunc('day', now() AT TIME ZONE 'Africa/Kigali') AT TIME ZONE 'Africa/Kigali')`);
    if (made >= roomsPerDay()) {
      await client.query('ROLLBACK');
      return { reason: 'daily_cap' };
    }
    let name;
    try {
      name = await createRoom();
    } catch (err) {
      // Only the error type is logged. Nothing from the request or the reply is written down.
      console.error('[video] room not made:', err.name);
      await client.query('ROLLBACK');
      return { reason: 'daily_failed' };
    }
    await client.query(
      'UPDATE bookings SET room_name = $1, room_created_at = now() WHERE id = $2', [name, bookingId]);
    await client.query('COMMIT');
    return { name };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// The answer when the call cannot start in the platform.
// The Meet link is given only for an accepted booking. The caller checks that before it gets here.
function fallbackReply(res, meetLink, reason) {
  const meet = meetLinkOf(meetLink);
  if (meet) return res.json({ provider: 'meet', url: meet, reason });
  return res.json({ provider: 'none', message: NO_ROOM, reason });
}

// POST /api/bookings/:id/join: the signed-in owner or the lawyer or the anonymous booker with the code.
// The code goes in the body and never in the address. Anyone else gets 404.
router.post('/:id/join', joinLimiter, optionalAuth, requireIntParam('id'), async (req, res) => {
  const NOT_FOUND = { error: 'Not found' };
  const typed = typeof req.body?.anon_token === 'string' ? normalizeAnonToken(req.body.anon_token) : null;
  const audioOnly = req.body?.audio_only === true;
  // The code is matched in SQL against the stored hash. Nothing is returned about the code.
  const [row] = await q(
    `SELECT b.id, b.status, b.user_id, p.user_id AS expert_user_id, p.meet_link,
            (b.anon_token IS NOT NULL AND b.anon_token = $2) AS anon_match
       FROM bookings b JOIN providers p ON p.id = b.provider_id
      WHERE b.id = $1`,
    [req.params.id, typed ? hashAnonToken(typed) : null]);
  if (!row) return res.status(404).json(NOT_FOUND);

  // The lawyer must still hold the legal_expert role. The role is read from the database.
  const expert = req.user?.role === 'legal_expert' && row.expert_user_id === req.user.id;
  const owner = Boolean(req.user) && row.user_id === req.user.id;
  if (!expert && !owner && !row.anon_match) return res.status(404).json(NOT_FOUND);

  // A request that is not accepted has no call. Its Meet link is never sent.
  if (row.status !== 'accepted') {
    return res.status(409).json({ error: 'This consultation has not been accepted yet, so there is no call to join.' });
  }

  // A call held inside the platform comes first. The lawyer is the host and everyone else is a guest.
  if (callConfigured()) {
    const ownRoom = roomNameFor(row.id);
    const role = expert ? 'host' : 'guest';
    return res.json({
      provider: 'own',
      room: ownRoom,
      role,
      ticket: signTicket({ room: ownRoom, role, audio: audioOnly }),
      signal_url: `${signalUrl()}/room/${ownRoom}`,
      ice_servers: await iceServers(),
      audioOnlyAllowed: true,
    });
  }

  const room = dailyAvailable() ? await claimRoom(row.id) : { reason: 'daily_unavailable' };
  if (room.name) {
    try {
      const token = await createToken(room.name, { owner: expert, audioOnly });
      return res.json({ provider: 'daily', url: roomUrl(room.name), token, audioOnlyAllowed: true });
    } catch (err) {
      console.error('[video] token not made:', err.name);
      return fallbackReply(res, row.meet_link, 'daily_failed');
    }
  }
  return fallbackReply(res, row.meet_link, room.reason);
});

export default router;

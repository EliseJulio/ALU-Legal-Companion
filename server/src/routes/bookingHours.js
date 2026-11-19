// A lawyer's consultation hours, and the free times a person can pick from.
// The hours are weekly windows on a 30-minute grid, in Kigali time. An entry that has never saved
// hours uses the standard hours. Saving replaces them, and saving an empty list closes the entry.
import { Router } from 'express';
import { q, pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { createLimiter } from '../middleware/rateLimit.js';
import {
  hoursOf, validateWindows, toApi, isBookable, openDays, dateRange, SLOT_MINUTES, TIMEZONE,
} from '../services/bookingHours.js';

const router = Router();

// Free times are public, so they are limited per address.
const slotsLimiter = createLimiter({
  max: 120,
  message: 'Too many requests for free times. Please wait a few minutes and try again.',
});

// Every directory entry linked to a lawyer's account, lowest id first. The list is empty when none is linked.
async function linkedEntryIds(userId) {
  const rows = await q('SELECT id FROM providers WHERE user_id = $1 ORDER BY id', [userId]);
  return rows.map((r) => r.id);
}

function hoursReply(windows, isDefault) {
  return { slot_minutes: SLOT_MINUTES, timezone: TIMEZONE, is_default: isDefault, windows: toApi(windows) };
}

// GET /api/bookings/availability: the lawyer's own hours
router.get('/availability', requireAuth('legal_expert'), async (req, res) => {
  const [id] = await linkedEntryIds(req.user.id);
  if (!id) return res.json(hoursReply([], false));
  const { windows, isDefault } = await hoursOf(id);
  res.json(hoursReply(windows, isDefault));
});

// PUT /api/bookings/availability: replaces every window of every linked entry in one transaction
router.put('/availability', requireAuth('legal_expert'), async (req, res) => {
  const checked = validateWindows(req.body?.windows);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const ids = await linkedEntryIds(req.user.id);
  if (!ids.length) return res.status(404).json({ error: 'No directory entry is linked to your account.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const id of ids) {
      // One save at a time for each entry. Without this, two saves delete and write the same rows at once.
      // Entries are locked in id order so two saves for one account cannot wait on each other.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('provider_availability'), $1)`, [id]);
      await client.query('DELETE FROM provider_availability WHERE provider_id = $1', [id]);
      for (const w of checked.windows) {
        await client.query(
          'INSERT INTO provider_availability (provider_id, weekday, start_minute, end_minute) VALUES ($1,$2,$3,$4)',
          [id, w.weekday, w.start_minute, w.end_minute]);
      }
      await client.query('UPDATE providers SET availability_set_at = now() WHERE id = $1', [id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  res.json(hoursReply(checked.windows, false));
});

// GET /api/bookings/slots/:providerId?from=YYYY-MM-DD&to=YYYY-MM-DD: open slots, public
router.get('/slots/:providerId', slotsLimiter, requireIntParam('providerId'), async (req, res) => {
  const providerId = req.params.providerId;
  if (!(await isBookable(providerId))) return res.status(404).json({ error: 'Not found' });
  const now = new Date();
  const range = dateRange(req.query, now);
  if (range.error) return res.status(400).json({ error: range.error });
  const days = await openDays(providerId, range.from, range.to, now);
  res.json({ provider_id: providerId, slot_minutes: SLOT_MINUTES, timezone: TIMEZONE, days });
});

export default router;

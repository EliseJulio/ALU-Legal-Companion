// The directory: lawyers, consultants and organisations that solve legal problems.
//
//   draft -> published      the admin publishes directly
//   published --(admin edits a checked fact)--> draft
// A wrong entry sends a person to the wrong office. That is as harmful as a wrong guide.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam, isValidId } from '../middleware/validate.js';
import { recordReview } from './reviewSteps.js';
import { kigaliToday } from '../services/reminders.js';

const router = Router();

// An entry that was not checked for more than 180 days is flagged as stale.
export const STALE_AFTER_DAYS = 180;

export const PROVIDER_CATEGORIES = ['lawyer', 'consultant', 'organisation'];
export const PROVIDER_TYPES = [
  'pro_bono_lawyer', 'maj_office', 'labour_inspector', 'abunzi', 'isange', 'investigation',
  'immigration', 'business_registry', 'legal_aid', 'ombudsman', 'human_rights', 'other',
];

// What the public may see. The columns are listed one by one and never copied with p.*.
// The row also holds user_id and a public page must not show which account sits behind an entry.
export const PUBLIC_PROVIDER_COLUMNS = `
  p.id, p.name, p.category, p.type, p.location, p.contact, p.services, p.languages, p.is_free,
  p.bookable, p.address, p.hours, p.address_note, p.official_source_url, p.last_checked_at,
  p.verified_at,
  (p.last_checked_at IS NULL OR p.last_checked_at < CURRENT_DATE - ${STALE_AFTER_DAYS}) AS stale`;

// The facts the admin checks. Editing one on a published entry sends it back to draft.
// Changing user_id, bookable or meet_link does not. Nobody relying on the directory is misled by that.
export const PROVIDER_CHECKED_FIELDS = [
  'name', 'category', 'type', 'location', 'contact', 'services', 'languages', 'is_free',
  'official_source_url', 'address', 'hours', 'address_note',
];
const OPTIONAL_TEXT = [
  'location', 'contact', 'services', 'languages', 'official_source_url', 'address', 'hours', 'address_note',
];

const clean = (v) => (typeof v === 'string' ? v.trim() : v);

// Returns a message for the first problem found or null. It runs on the merged row so a
// partial edit is checked as the entry it would become.
async function providerError(p) {
  if (typeof p.name !== 'string' || !p.name) return 'name is required';
  if (p.name.length > 200) return 'name must be 200 characters or fewer';
  if (!PROVIDER_CATEGORIES.includes(p.category)) return `category must be one of: ${PROVIDER_CATEGORIES.join(', ')}`;
  if (!PROVIDER_TYPES.includes(p.type)) return `type must be one of: ${PROVIDER_TYPES.join(', ')}`;
  if (p.official_source_url) {
    let url;
    try { url = new URL(String(p.official_source_url)); } catch { return 'official_source_url must be a full https:// address'; }
    if (url.protocol !== 'https:') return 'official_source_url must start with https://';
  }
  if (p.user_id !== null && p.user_id !== undefined) {
    if (!isValidId(p.user_id)) return 'user_id must be the id of a legal expert account';
    // An active account. The account behind an entry can read every matter shared with it. So it must
    // be a real legal expert whose account is switched on.
    const [expert] = await q("SELECT id FROM users WHERE id = $1 AND role = 'legal_expert' AND deactivated_at IS NULL", [p.user_id]);
    if (!expert) return 'user_id must be the id of a legal expert account';
  }
  // The room is shown as a link. A link like javascript:... would run a script when it is
  // clicked. So only an https://meet.google.com/ address is accepted.
  if (p.meet_link) {
    let url;
    try { url = new URL(String(p.meet_link)); } catch { return 'meet_link must be a full https://meet.google.com/... address'; }
    if (url.protocol !== 'https:' || url.hostname !== 'meet.google.com') {
      return 'meet_link must be an https://meet.google.com/... address';
    }
  }
  // The expert finds booking requests through the linked account. Without it the requests
  // would go nowhere and nothing would show an error.
  if (p.bookable && !p.user_id) return 'Link a legal expert account before the entry can take bookings.';
  return null;
}

// ------------------------------------------------------------------------------ public

// GET /api/directory/providers: published entries only.
// Each row has the date it was last checked and when an admin published it.
// Filters: ?category= ?type= ?free=true ?q= (name or place or services)
router.get('/providers', async (req, res) => {
  const params = [];
  let where = `p.status = 'published'`;
  if (typeof req.query.category === 'string' && req.query.category) {
    params.push(req.query.category);
    where += ` AND p.category = $${params.length}`;
  }
  if (typeof req.query.type === 'string' && req.query.type) {
    params.push(req.query.type);
    where += ` AND p.type = $${params.length}`;
  }
  if (req.query.free === 'true') where += ' AND p.is_free';
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    // % and _ are escaped so a typed % is searched for and does not match everything.
    params.push(`%${req.query.q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&')}%`);
    where += ` AND (p.name ILIKE $${params.length} OR p.location ILIKE $${params.length}
                    OR p.services ILIKE $${params.length})`;
  }
  res.json(await q(
    `SELECT ${PUBLIC_PROVIDER_COLUMNS}
       FROM providers p
      WHERE ${where}
      ORDER BY p.bookable DESC, p.name`,
    params));
});

// ------------------------------------------------------------------------------ staff

// GET /api/directory/providers/all: every entry in every state.
// Only the admin can read it. It also carries user_id, the legal expert account behind an
// entry. The public list never shows it.
router.get('/providers/all', requireAuth('admin'), async (req, res) => {
  res.json(await q(
    `SELECT p.id, p.user_id, p.meet_link, p.bookable,
            p.name, p.category, p.type, p.location, p.contact, p.services, p.languages, p.is_free,
            p.address, p.hours, p.address_note,
            p.official_source_url, p.last_checked_at, p.status, p.verified_at, p.updated_at,
            (p.last_checked_at IS NULL OR p.last_checked_at < CURRENT_DATE - ${STALE_AFTER_DAYS}) AS stale
       FROM providers p
      ORDER BY p.updated_at DESC, p.id`));
});

// GET /api/directory/providers/:id : one published listing in full. It must come after /providers/all
// so that the word "all" is not read as an id. A draft, a submitted entry and an id that does not
// exist all give the same 404. Nothing is learned about what is unpublished.
router.get('/providers/:id', requireIntParam('id'), async (req, res) => {
  const [provider] = await q(
    `SELECT ${PUBLIC_PROVIDER_COLUMNS}
       FROM providers p
      WHERE p.id = $1 AND p.status = 'published'`,
    [req.params.id]);
  if (!provider) return res.status(404).json({ error: 'That listing is not in the directory' });
  res.json(provider);
});

// POST /api/directory/providers: a new entry always starts as a draft. The admin publishes it once it is checked.
router.post('/providers', requireAuth('admin'), async (req, res) => {
  const b = req.body || {};
  const p = {
    name: clean(b.name),
    category: b.category,
    type: b.type,
    is_free: b.is_free === true,
    user_id: b.user_id ?? null,
    bookable: b.bookable === true,
    meet_link: clean(b.meet_link) || null,
  };
  for (const k of OPTIONAL_TEXT) p[k] = clean(b[k]) || null;
  const error = await providerError(p);
  if (error) return res.status(400).json({ error });

  const [row] = await q(
    `INSERT INTO providers (name, category, type, location, contact, services, languages, is_free,
                            official_source_url, user_id, bookable, meet_link, address, hours, address_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [p.name, p.category, p.type, p.location, p.contact, p.services, p.languages, p.is_free,
     p.official_source_url, p.user_id, p.bookable, p.meet_link, p.address, p.hours, p.address_note]);
  res.status(201).json(row);
});

// PUT /api/directory/providers/:id
// A key the request did not send keeps its value. A key sent as null is cleared. This is how an
// admin unlinks an expert account.
// If a checked fact changed the entry goes back to draft and loses its stamp until the admin
// publishes it again. A change to user_id does not.
router.put('/providers/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [existing] = await q('SELECT * FROM providers WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Provider not found' });

  const has = (k) => Object.prototype.hasOwnProperty.call(req.body || {}, k);
  const merged = {};
  for (const k of [...PROVIDER_CHECKED_FIELDS, 'user_id', 'bookable', 'meet_link']) {
    merged[k] = has(k) ? clean(req.body[k]) : existing[k];
  }
  for (const k of OPTIONAL_TEXT) merged[k] = merged[k] || null;
  merged.is_free = merged.is_free === true;
  merged.bookable = merged.bookable === true;
  merged.meet_link = merged.meet_link || null;

  const error = await providerError(merged);
  if (error) return res.status(400).json({ error });

  const factChanged = PROVIDER_CHECKED_FIELDS.some((k) => merged[k] !== existing[k]);
  const resetSql = factChanged ? `, status = 'draft', verified_by = NULL, verified_at = NULL` : '';

  const [row] = await q(
    `UPDATE providers SET name=$1, category=$2, type=$3, location=$4, contact=$5, services=$6,
            languages=$7, is_free=$8, official_source_url=$9, user_id=$10, bookable=$11,
            meet_link=$12, address=$13, hours=$14, address_note=$15, updated_at=now()${resetSql}
      WHERE id=$16 RETURNING *`,
    [merged.name, merged.category, merged.type, merged.location, merged.contact, merged.services,
     merged.languages, merged.is_free, merged.official_source_url, merged.user_id, merged.bookable,
     merged.meet_link, merged.address, merged.hours, merged.address_note, existing.id]);

  // Pointing the entry at a different account or removing the link changes who can read every matter
  // already shared with it. The owners agreed to share with this office and not with whoever an admin
  // links to it next. So those shares end here and each owner is told. They can share again.
  if (String(merged.user_id ?? '') !== String(existing.user_id ?? '')) {
    await q(
      `WITH ended AS (
         UPDATE matters SET shared_with = NULL, shared_at = NULL, updated_at = now()
          WHERE shared_with = $1 RETURNING id, user_id)
       INSERT INTO matter_events (matter_id, author_id, occurred_on, description)
       SELECT id, user_id, $2, $3 FROM ended`,
      [row.id, kigaliToday(),
       `Sharing with ${row.name} ended because the contact account of that office was changed. Share again if you still want them to see this.`]);
  }
  res.json(row);
});

// ------------------------------------------------------------------------------ publishing

router.post('/providers/:id/publish', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [row] = await q(
    `UPDATE providers SET status = 'published', verified_by = $1, verified_at = now(),
            last_checked_at = (now() AT TIME ZONE 'Africa/Kigali')::date, updated_at = now()
      WHERE id = $2 AND status <> 'published' RETURNING id, status`,
    [req.user.id, req.params.id]);
  if (!row) return res.status(400).json({ error: 'That entry could not be found or is already published' });
  await recordReview('provider', row.id, req.user.id, 'published');
  res.json(row);
});

export default router;

// The directory: lawyers, consultants and organisations that solve legal problems.
//
// An entry follows the same steps as a guide.
//   draft -> pending_review -> published      only a legal expert publishes
//   published --(admin edits a checked fact)--> draft, stamp cleared
// A wrong entry sends a person to the wrong office. That is as harmful as a wrong guide.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam, isValidId } from '../middleware/validate.js';
import { addReviewSteps } from './reviewSteps.js';

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
  p.official_source_url, p.last_checked_at, p.verified_at, vu.name AS verified_by_name,
  (p.last_checked_at IS NULL OR p.last_checked_at < CURRENT_DATE - ${STALE_AFTER_DAYS}) AS stale`;

// The facts an expert checks. Editing one on a published entry sends it back to draft.
// Changing user_id does not. Nobody relying on the directory is misled by that.
export const PROVIDER_CHECKED_FIELDS = [
  'name', 'category', 'type', 'location', 'contact', 'services', 'languages', 'is_free',
  'official_source_url',
];
const OPTIONAL_TEXT = ['location', 'contact', 'services', 'languages', 'official_source_url'];

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
    const [expert] = await q("SELECT id FROM users WHERE id = $1 AND role = 'legal_expert'", [p.user_id]);
    if (!expert) return 'user_id must be the id of a legal expert account';
  }
  return null;
}

// ------------------------------------------------------------------------------ public

// GET /api/directory/providers: published entries only.
// Each row has the date it was last checked and who verified it.
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
       FROM providers p LEFT JOIN users vu ON vu.id = p.verified_by
      WHERE ${where}
      ORDER BY p.name`,
    params));
});

// ------------------------------------------------------------------------------ staff

// GET /api/directory/providers/all: every entry in every state.
// The admin and the legal expert use it. Only the admin sees user_id. The expert does not
// need to know which account sits behind an entry to check a phone number.
// review_comment is the comment on the latest review. It is empty after a verification,
// so an old return stops showing by itself.
router.get('/providers/all', requireAuth('admin', 'legal_expert'), async (req, res) => {
  res.json(await q(
    `SELECT p.id, CASE WHEN $1::text = 'admin' THEN p.user_id END AS user_id,
            p.name, p.category, p.type, p.location, p.contact, p.services, p.languages, p.is_free,
            p.official_source_url, p.last_checked_at, p.status, p.verified_at, p.updated_at,
            vu.name AS verified_by_name,
            (p.last_checked_at IS NULL OR p.last_checked_at < CURRENT_DATE - ${STALE_AFTER_DAYS}) AS stale,
            (SELECT dr.comment FROM directory_reviews dr
              WHERE dr.record_type = 'provider' AND dr.record_id = p.id
              ORDER BY dr.id DESC LIMIT 1) AS review_comment
       FROM providers p
       LEFT JOIN users vu ON vu.id = p.verified_by
      ORDER BY p.updated_at DESC, p.id`,
    [req.user.role]));
});

// POST /api/directory/providers: a new entry always starts as a draft.
// Publishing is a legal expert's act. It is never a field an admin can send.
router.post('/providers', requireAuth('admin'), async (req, res) => {
  const b = req.body || {};
  const p = {
    name: clean(b.name),
    category: b.category,
    type: b.type,
    is_free: b.is_free === true,
    user_id: b.user_id ?? null,
  };
  for (const k of OPTIONAL_TEXT) p[k] = clean(b[k]) || null;
  const error = await providerError(p);
  if (error) return res.status(400).json({ error });

  const [row] = await q(
    `INSERT INTO providers (name, category, type, location, contact, services, languages, is_free,
                            official_source_url, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [p.name, p.category, p.type, p.location, p.contact, p.services, p.languages, p.is_free,
     p.official_source_url, p.user_id]);
  res.status(201).json(row);
});

// PUT /api/directory/providers/:id
// A key the request did not send keeps its value. A key sent as null is cleared. This is how an
// admin unlinks an expert account.
// If a checked fact changed the entry goes back to draft and loses its stamp until an expert
// checks it again. A change to user_id does not.
router.put('/providers/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [existing] = await q('SELECT * FROM providers WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Provider not found' });

  const has = (k) => Object.prototype.hasOwnProperty.call(req.body || {}, k);
  const merged = {};
  for (const k of [...PROVIDER_CHECKED_FIELDS, 'user_id']) {
    merged[k] = has(k) ? clean(req.body[k]) : existing[k];
  }
  for (const k of OPTIONAL_TEXT) merged[k] = merged[k] || null;
  merged.is_free = merged.is_free === true;

  const error = await providerError(merged);
  if (error) return res.status(400).json({ error });

  const factChanged = PROVIDER_CHECKED_FIELDS.some((k) => merged[k] !== existing[k]);
  const resetSql = factChanged ? `, status = 'draft', verified_by = NULL, verified_at = NULL` : '';

  const [row] = await q(
    `UPDATE providers SET name=$1, category=$2, type=$3, location=$4, contact=$5, services=$6,
            languages=$7, is_free=$8, official_source_url=$9, user_id=$10, updated_at=now()${resetSql}
      WHERE id=$11 RETURNING *`,
    [merged.name, merged.category, merged.type, merged.location, merged.contact, merged.services,
     merged.languages, merged.is_free, merged.official_source_url, merged.user_id, existing.id]);
  res.json(row);
});

// ------------------------------------------------------------------------------ the steps

// Verifying an entry also sets last_checked_at. The expert's check against the body's own
// source is the check that date describes. It is the date in Kigali.
addReviewSteps(router, {
  segment: 'providers',
  table: 'providers',
  recordType: 'provider',
  noun: 'directory entries',
  verifiedSql: ", last_checked_at = (now() AT TIME ZONE 'Africa/Kigali')::date",
});

export default router;

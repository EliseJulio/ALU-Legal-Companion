// The directory: where a person can get legal help.
//
// Entries follow the same steps as guides:
//   draft -> pending_review -> published     only a legal expert publishes
//   published -> draft                       when an admin edits a checked fact
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';

const router = Router();

// An entry not checked for more than this many days is marked as out of date.
export const STALE_AFTER_DAYS = 180;

// What the public may see of an entry. The columns are listed one by one, never `p.*`.
export const PUBLIC_PROVIDER_COLUMNS = `
  p.id, p.name, p.type, p.location, p.contact, p.services, p.languages, p.is_free,
  p.official_source_url, p.last_checked_at, p.verified_at, vu.name AS verified_by_name,
  (p.last_checked_at IS NULL OR p.last_checked_at < CURRENT_DATE - ${STALE_AFTER_DAYS}) AS stale`;

// The facts a legal expert checks. Editing any of these on a published entry sends it back to
// draft.
export const PROVIDER_CHECKED_FIELDS = [
  'name', 'type', 'location', 'contact', 'services', 'languages', 'is_free', 'official_source_url',
];

// Saves a review decision. Decisions are only added, never changed.
async function recordReview(type, id, reviewerId, decision, comment = null) {
  await q(
    `INSERT INTO directory_reviews (record_type, record_id, reviewer_id, decision, comment)
     VALUES ($1,$2,$3,$4,$5)`,
    [type, id, reviewerId, decision, comment],
  );
}

// The latest review of a record, when it was a return. This is the "current comment". A later
// verification hides an older return comment by itself.
const LATEST_RETURN = (type, alias) => `
  LEFT JOIN LATERAL (
    SELECT dr.comment, dr.created_at, dr.decision, dr.reviewer_id
      FROM directory_reviews dr
     WHERE dr.record_type = '${type}' AND dr.record_id = ${alias}.id
     ORDER BY dr.id DESC LIMIT 1
  ) rv ON rv.decision = 'returned'
  LEFT JOIN users rvu ON rvu.id = rv.reviewer_id`;

// GET /api/directory/providers/all: every entry in every state, for admins and legal experts.
router.get('/providers/all', requireAuth('admin', 'legal_expert'), async (_req, res) => {
  res.json(await q(
    `SELECT p.id, p.name, p.type, p.location, p.contact, p.services, p.languages,
            p.is_free, p.official_source_url, p.last_checked_at, p.status, p.verified_at,
            p.updated_at, vu.name AS verified_by_name,
            (p.last_checked_at IS NULL OR p.last_checked_at < CURRENT_DATE - ${STALE_AFTER_DAYS}) AS stale,
            rv.comment AS review_comment, rv.created_at AS review_comment_at,
            rvu.name AS review_comment_by_name
       FROM providers p
       LEFT JOIN users vu ON vu.id = p.verified_by
       ${LATEST_RETURN('provider', 'p')}
      ORDER BY p.updated_at DESC, p.id`));
});

// The review steps. One set of routes for each kind of record so they cannot drift apart.
const TABLES = { providers: ['providers', 'provider'] };

for (const [segment, [table, recordType]] of Object.entries(TABLES)) {
  const noun = 'directory entries';

  // An admin sends a draft for review.
  router.post(`/${segment}/:id/submit`, requireAuth('admin'), requireIntParam('id'), async (req, res) => {
    const [row] = await q(
      `UPDATE ${table} SET status='pending_review', updated_at=now()
        WHERE id=$1 AND status='draft' RETURNING id, status`,
      [req.params.id]);
    if (!row) return res.status(400).json({ error: `Only draft ${noun} can be submitted for review` });
    res.json(row);
  });

  // A legal expert verifies an entry. This also dates the check because the expert has just
  // checked it against the body's own source.
  router.post(`/${segment}/:id/verify`, requireAuth('legal_expert'), requireIntParam('id'), async (req, res) => {
    const [row] = await q(
      `UPDATE ${table} SET status='published', verified_by=$1, verified_at=now(), updated_at=now(),
              last_checked_at = CURRENT_DATE
        WHERE id=$2 AND status='pending_review' RETURNING id, status, verified_at`,
      [req.user.id, req.params.id]);
    if (!row) return res.status(400).json({ error: `Only ${noun} pending review can be verified` });
    await recordReview(recordType, row.id, req.user.id, 'verified');
    res.json(row);
  });

  // A legal expert sends an entry back with the reason.
  router.post(`/${segment}/:id/return`, requireAuth('legal_expert'), requireIntParam('id'), async (req, res) => {
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    if (!comment) return res.status(400).json({ error: 'Please say what needs changing before returning it.' });
    const [row] = await q(
      `UPDATE ${table} SET status='draft', updated_at=now()
        WHERE id=$1 AND status='pending_review' RETURNING id, status`,
      [req.params.id]);
    if (!row) return res.status(400).json({ error: `Only ${noun} pending review can be returned` });
    await recordReview(recordType, row.id, req.user.id, 'returned', comment);
    res.json({ ...row, review_comment: comment });
  });
}

export default router;

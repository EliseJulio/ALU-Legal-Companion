// The review steps shared by the directory entries and the routes.
//   submit   the admin sends a draft to the legal expert
//   verify   the legal expert publishes it
//   return   the legal expert sends it back with a reason
// One function adds all three. This way the two kinds of record cannot drift apart.
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';

async function recordReview(type, id, reviewerId, decision, comment = null) {
  await q(
    `INSERT INTO directory_reviews (record_type, record_id, reviewer_id, decision, comment)
     VALUES ($1,$2,$3,$4,$5)`,
    [type, id, reviewerId, decision, comment],
  );
}

// `verifiedSql` is extra SQL that runs when a record is verified. It starts with a comma.
export function addReviewSteps(router, { segment, table, recordType, noun, verifiedSql = '' }) {
  router.post(`/${segment}/:id/submit`, requireAuth('admin'), requireIntParam('id'), async (req, res) => {
    const [row] = await q(
      `UPDATE ${table} SET status='pending_review', updated_at=now()
        WHERE id=$1 AND status='draft' RETURNING id, status`,
      [req.params.id]);
    if (!row) return res.status(400).json({ error: `Only draft ${noun} can be submitted for review` });
    res.json(row);
  });

  router.post(`/${segment}/:id/verify`, requireAuth('legal_expert'), requireIntParam('id'), async (req, res) => {
    const [row] = await q(
      `UPDATE ${table} SET status='published', verified_by=$1, verified_at=now(), updated_at=now()${verifiedSql}
        WHERE id=$2 AND status='pending_review' RETURNING id, status, verified_at`,
      [req.user.id, req.params.id]);
    if (!row) return res.status(400).json({ error: `Only ${noun} pending review can be verified` });
    await recordReview(recordType, row.id, req.user.id, 'verified');
    res.json(row);
  });

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

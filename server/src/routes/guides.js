// Guides: public reading, the admin editor and the review steps
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { indexGuide, deindexGuide } from '../services/rag.js';

const router = Router();
const TEMPLATE_FIELDS = ['domain', 'title', 'situation', 'law_says', 'your_rights', 'steps', 'get_help', 'source_law'];

// The areas of law a guide can belong to. The client has the same list for its filter buttons
// so the two lists must match. An unknown area is refused because a guide in a sixth area
// would have no filter button and could only be found by search.
export const DOMAINS = ['tenancy', 'employment', 'business', 'immigration', 'harassment'];

// Trims and lowercases, so every guide is saved with one spelling.
const normalizeDomain = (value) => String(value ?? '').trim().toLowerCase();

// GET /api/guides?search=&domain=: published guides only
router.get('/', async (req, res) => {
  const { search, domain } = req.query;
  let sql = `SELECT g.id, g.domain, g.title, g.source_law, g.verified_at, u.name AS verified_by_name
               FROM guides g LEFT JOIN users u ON u.id = g.verified_by
              WHERE g.status = 'published'`;
  const params = [];
  if (domain) { params.push(normalizeDomain(domain)); sql += ` AND lower(g.domain) = $${params.length}`; }
  if (search) {
    params.push(search);
    sql += ` AND to_tsvector('english', g.title || ' ' || g.situation || ' ' || g.law_says) @@ plainto_tsquery('english', $${params.length})`;
  }
  sql += ' ORDER BY g.verified_at DESC NULLS LAST';
  res.json(await q(sql, params));
});

// GET /api/guides/all: every guide in every status for admins and legal experts.
// It must come before /:id or "all" would be read as an id.
// It also shows the expert's comment when the guide was returned. The comment is internal
// feedback for the admin so no public route shows it.
//
// The subquery takes the latest review of each guide. The comment is only shown if that
// latest review was a return. So a later verification hides the old comment and a draft made
// by an admin edit does not show a comment from a review that is already finished.
router.get('/all', requireAuth('admin', 'legal_expert'), async (_req, res) => {
  res.json(await q(`SELECT g.*, u.name AS verified_by_name,
                           r.comment     AS review_comment,
                           r.created_at  AS review_comment_at,
                           ru.name       AS review_comment_by_name
                      FROM guides g
                      LEFT JOIN users u ON u.id = g.verified_by
                      LEFT JOIN LATERAL (
                        SELECT gr.comment, gr.created_at, gr.reviewer_id, gr.decision
                          FROM guide_reviews gr
                         WHERE gr.guide_id = g.id
                         ORDER BY gr.id DESC
                         LIMIT 1
                      ) r ON r.decision = 'returned'
                      LEFT JOIN users ru ON ru.id = r.reviewer_id
                     ORDER BY g.updated_at DESC`));
});

// GET /api/guides/:id: one guide. Only published guides are public.
// A draft gets the same 404 as a guide that does not exist.
router.get('/:id', requireIntParam('id'), async (req, res) => {
  const [guide] = await q(
    `SELECT g.*, u.name AS verified_by_name FROM guides g
     LEFT JOIN users u ON u.id = g.verified_by WHERE g.id = $1`, [req.params.id]);
  if (!guide || guide.status !== 'published') return res.status(404).json({ error: 'Guide not found' });
  res.json(guide);
});

// POST /api/guides: an admin creates a draft
router.post('/', requireAuth('admin'), async (req, res) => {
  const missing = TEMPLATE_FIELDS.filter((f) => !req.body?.[f]);
  if (missing.length) return res.status(400).json({ error: `Missing template fields: ${missing.join(', ')}` });
  const domain = normalizeDomain(req.body.domain);
  if (!DOMAINS.includes(domain)) {
    return res.status(400).json({ error: `Unknown area of law: ${DOMAINS.join(', ')}` });
  }
  const vals = TEMPLATE_FIELDS.map((f) => (f === 'domain' ? domain : req.body[f]));
  const [guide] = await q(
    `INSERT INTO guides (${TEMPLATE_FIELDS.join(',')}, source_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [...vals, req.body.source_url || null],
  );
  res.status(201).json(guide);
});

// PUT /api/guides/:id: an admin edits a guide.
// Any edit sends the guide back to draft and clears the verifier. A guide that has been
// changed is no longer the text the legal expert checked.
router.put('/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [existing] = await q('SELECT * FROM guides WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Guide not found' });
  // Fields that were not sent keep their old value.
  const merged = {};
  for (const f of [...TEMPLATE_FIELDS, 'source_url']) merged[f] = req.body?.[f] ?? existing[f];
  merged.domain = normalizeDomain(merged.domain);
  // Check the domain before saving. Saving first would take a verified guide off the site
  // because of a typo with nothing changed in return.
  if (!DOMAINS.includes(merged.domain)) {
    return res.status(400).json({ error: `Unknown area of law: ${DOMAINS.join(', ')}` });
  }
  // The assistant's text for this guide is deleted first. If saving fails after that the
  // assistant simply has no text for the guide which is the safe result.
  await deindexGuide(existing.id);
  const [guide] = await q(
    `UPDATE guides SET domain=$1,title=$2,situation=$3,law_says=$4,your_rights=$5,steps=$6,get_help=$7,source_law=$8,source_url=$9,
            status='draft', verified_by=NULL, verified_at=NULL, updated_at=now()
     WHERE id=$10 RETURNING *`,
    [...TEMPLATE_FIELDS.map((f) => merged[f]), merged.source_url, req.params.id],
  );
  res.json(guide);
});

// POST /api/guides/:id/submit: draft to pending_review
router.post('/:id/submit', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [guide] = await q(
    `UPDATE guides SET status='pending_review', updated_at=now() WHERE id=$1 AND status='draft' RETURNING *`,
    [req.params.id]);
  if (!guide) return res.status(400).json({ error: 'Only drafts can be submitted for review' });
  res.json(guide);
});

// POST /api/guides/:id/verify: a legal expert approves the guide and it is published.
// Only a legal expert can do this. An admin cannot publish a guide.
router.post('/:id/verify', requireAuth('legal_expert'), requireIntParam('id'), async (req, res) => {
  const [guide] = await q(
    `UPDATE guides SET status='published', verified_by=$1, verified_at=now(), updated_at=now()
     WHERE id=$2 AND status='pending_review' RETURNING *`,
    [req.user.id, req.params.id]);
  if (!guide) return res.status(400).json({ error: 'Only guides pending review can be verified' });
  // Save the decision. This ends the review, so an earlier return comment stops showing.
  await q(`INSERT INTO guide_reviews (guide_id, reviewer_id, decision) VALUES ($1, $2, 'verified')`,
    [guide.id, req.user.id]);
  // Only now does the assistant get to read the guide. The chunks are made after publishing.
  await indexGuide(guide);
  res.json(guide);
});

// POST /api/guides/:id/return: a legal expert sends a guide back to draft with the reason.
// The reason is required. A guide sent back with no reason leaves the admin with a draft they
// cannot act on. The reason is checked before the guide is moved, so a request that is going
// to be refused does not take the guide out of the review queue.
router.post('/:id/return', requireAuth('legal_expert'), requireIntParam('id'), async (req, res) => {
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
  if (!comment) {
    return res.status(400).json({ error: 'Please say what needs changing before returning this guide.' });
  }

  const [guide] = await q(
    `UPDATE guides SET status='draft', updated_at=now() WHERE id=$1 AND status='pending_review' RETURNING *`,
    [req.params.id]);
  if (!guide) return res.status(400).json({ error: 'Only guides pending review can be returned' });

  await q(
    `INSERT INTO guide_reviews (guide_id, reviewer_id, decision, comment) VALUES ($1, $2, 'returned', $3)`,
    [guide.id, req.user.id, comment]);

  res.json({ ...guide, review_comment: comment });
});

// Saved guides for students and staff. The list itself is in routes/bookmarks.js.

// POST /api/guides/:id/bookmark: save a guide.
// Only a published guide can be saved. The 404 is the same one a draft gets when it is read,
// so nobody can use this route to find out that an unverified guide exists.
// Saving twice does nothing, because a double tap on a slow connection is not an error.
router.post('/:id/bookmark', requireAuth('student', 'staff'), requireIntParam('id'), async (req, res) => {
  const [guide] = await q(`SELECT id FROM guides WHERE id = $1 AND status = 'published'`, [req.params.id]);
  if (!guide) return res.status(404).json({ error: 'Guide not found' });

  await q(
    `INSERT INTO bookmarks (user_id, guide_id) VALUES ($1, $2)
     ON CONFLICT (user_id, guide_id) DO NOTHING`,
    [req.user.id, guide.id],
  );
  res.status(201).json({ guide_id: guide.id, bookmarked: true });
});

// DELETE /api/guides/:id/bookmark: remove a save. It only touches the caller's own row, so
// removing someone else's is just a miss.
router.delete('/:id/bookmark', requireAuth('student', 'staff'), requireIntParam('id'), async (req, res) => {
  const removed = await q(
    'DELETE FROM bookmarks WHERE user_id = $1 AND guide_id = $2 RETURNING id',
    [req.user.id, req.params.id],
  );
  if (!removed.length) return res.status(404).json({ error: 'You have not saved this guide' });
  res.status(204).end();
});

export default router;

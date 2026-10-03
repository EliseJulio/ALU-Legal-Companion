// The directory: where a person can get legal help.
//
// Entries follow the same steps as guides:
//   draft -> pending_review -> published     only a legal expert publishes
//   published -> draft                       when an admin edits a checked fact
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam, isValidId } from '../middleware/validate.js';
import { searchRoutes } from '../services/routing.js';

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

const ROUTE_FIELDS = [
  'matter_type', 'title', 'keywords', 'first_forum_id', 'legal_basis', 'exclusions', 'steps',
  'deadline_days', 'deadline_runs_from', 'deadline_note',
];

const clean = (v) => (typeof v === 'string' ? v.trim() : v);

// Turns the steps into a list of non-empty strings. Returns null if it is not a list.
function stepsFrom(value) {
  if (!Array.isArray(value)) return null;
  return value.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
}

// Returns an error message or null if the route is fine. It is run on the whole route as it
// would be saved so an edit with only a few fields is checked as the complete route.
function routeError(r) {
  if (!r.matter_type || !/^[a-z0-9_]{3,60}$/.test(r.matter_type)) {
    return 'matter_type must be 3 to 60 lowercase letters, digits or underscores';
  }
  if (!r.title) return 'title is required: the situation in the words a reader would use';
  if (!r.legal_basis) return 'legal_basis is required: the article that sends this matter there';
  if (!isValidId(r.first_forum_id)) return 'first_forum_id must name a directory entry';
  if (!Array.isArray(r.steps) || r.steps.length === 0) return 'steps must list at least one step';
  const hasDays = r.deadline_days !== null && r.deadline_days !== undefined && r.deadline_days !== '';
  const hasFrom = Boolean(r.deadline_runs_from);
  if (hasDays !== hasFrom) {
    return 'A deadline needs both a number of days and what it runs from, or neither';
  }
  if (hasDays && !(Number.isInteger(Number(r.deadline_days)) && Number(r.deadline_days) > 0)) {
    return 'deadline_days must be a whole number of days greater than zero';
  }
  return null;
}

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

// GET /api/directory/routes?q=: the matters a person can pick. With q, only the matters that
// match the words, best first. A route is listed only if its office is published too.
router.get('/routes', async (req, res) => {
  res.json(await searchRoutes(typeof req.query.q === 'string' ? req.query.q : ''));
});

// GET /api/directory/routes/all: every route in every state, for admins and legal experts.
// It shows the office name and status, so a reviewer can see a route that is ready when its
// office is not.
router.get('/routes/all', requireAuth('admin', 'legal_expert'), async (_req, res) => {
  res.json(await q(
    `SELECT r.id, r.matter_type, r.title, r.keywords, r.first_forum_id, r.legal_basis,
            r.exclusions, r.steps, r.deadline_days, r.deadline_runs_from, r.deadline_note,
            r.status, r.verified_at, r.updated_at, vu.name AS verified_by_name,
            p.name AS first_forum_name, p.status AS first_forum_status,
            rv.comment AS review_comment, rv.created_at AS review_comment_at,
            rvu.name AS review_comment_by_name
       FROM matter_routes r
       JOIN providers p ON p.id = r.first_forum_id
       LEFT JOIN users vu ON vu.id = r.verified_by
       ${LATEST_RETURN('route', 'r')}
      ORDER BY r.updated_at DESC, r.id`));
});

// GET /api/directory/routes/:id: the whole answer for one matter.
// This must come after /routes/all, or "all" would be read as an id.
router.get('/routes/:id', requireIntParam('id'), async (req, res) => {
  const [route] = await q(
    `SELECT r.id, r.matter_type, r.title, r.legal_basis, r.exclusions, r.steps,
            r.deadline_days, r.deadline_runs_from, r.deadline_note,
            r.verified_at, u.name AS verified_by_name, r.first_forum_id
       FROM matter_routes r
       LEFT JOIN users u ON u.id = r.verified_by
      WHERE r.id = $1 AND r.status = 'published'`,
    [req.params.id],
  );
  if (!route) return res.status(404).json({ error: 'That matter is not in the directory' });
  const [forum] = await q(
    `SELECT ${PUBLIC_PROVIDER_COLUMNS}
       FROM providers p LEFT JOIN users vu ON vu.id = p.verified_by
      WHERE p.id = $1 AND p.status = 'published'`,
    [route.first_forum_id],
  );
  // Never show a route whose office nobody has checked.
  if (!forum) return res.status(404).json({ error: 'That matter is not in the directory' });
  delete route.first_forum_id;
  res.json({ ...route, first_forum: forum });
});

// POST /api/directory/routes: an admin adds a route. It always starts as a draft.
router.post('/routes', requireAuth('admin'), async (req, res) => {
  const b = req.body || {};
  const r = {
    matter_type: clean(b.matter_type),
    title: clean(b.title),
    keywords: clean(b.keywords) || '',
    first_forum_id: b.first_forum_id,
    legal_basis: clean(b.legal_basis),
    exclusions: clean(b.exclusions) || null,
    steps: stepsFrom(b.steps),
    deadline_days: b.deadline_days ?? null,
    deadline_runs_from: clean(b.deadline_runs_from) || null,
    deadline_note: clean(b.deadline_note) || null,
  };
  const err = routeError(r);
  if (err) return res.status(400).json({ error: err });
  const [forum] = await q('SELECT id FROM providers WHERE id = $1', [r.first_forum_id]);
  if (!forum) return res.status(400).json({ error: 'first_forum_id must name a directory entry' });
  const [dup] = await q('SELECT id FROM matter_routes WHERE matter_type = $1', [r.matter_type]);
  if (dup) return res.status(409).json({ error: 'A route for that matter_type already exists' });

  const [row] = await q(
    `INSERT INTO matter_routes (${ROUTE_FIELDS.join(',')})
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    ROUTE_FIELDS.map((f) => (f === 'deadline_days' && r[f] !== null ? Number(r[f]) : r[f])),
  );
  delete row.tsv;
  res.status(201).json(row);
});

// PUT /api/directory/routes/:id: an admin edits a route.
// Any edit sends the route back to draft and clears the verifier. Every field of a route is a
// checked fact, so no field is left out of this rule.
router.put('/routes/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [existing] = await q('SELECT * FROM matter_routes WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Route not found' });
  const has = (k) => Object.prototype.hasOwnProperty.call(req.body || {}, k);
  const merged = {};
  for (const f of ROUTE_FIELDS) {
    if (!has(f)) { merged[f] = existing[f]; continue; }
    merged[f] = f === 'steps' ? stepsFrom(req.body[f]) : clean(req.body[f]);
    if (merged[f] === '' && f !== 'keywords') merged[f] = null;
  }
  merged.keywords = merged.keywords || '';
  const err = routeError(merged);
  if (err) return res.status(400).json({ error: err });
  if (merged.first_forum_id !== existing.first_forum_id) {
    const [forum] = await q('SELECT id FROM providers WHERE id = $1', [merged.first_forum_id]);
    if (!forum) return res.status(400).json({ error: 'first_forum_id must name a directory entry' });
  }
  if (merged.matter_type !== existing.matter_type) {
    const [dup] = await q('SELECT id FROM matter_routes WHERE matter_type = $1 AND id <> $2',
      [merged.matter_type, existing.id]);
    if (dup) return res.status(409).json({ error: 'A route for that matter_type already exists' });
  }
  const [row] = await q(
    `UPDATE matter_routes SET matter_type=$1, title=$2, keywords=$3, first_forum_id=$4,
            legal_basis=$5, exclusions=$6, steps=$7, deadline_days=$8, deadline_runs_from=$9,
            deadline_note=$10, status='draft', verified_by=NULL, verified_at=NULL, updated_at=now()
      WHERE id=$11 RETURNING *`,
    [...ROUTE_FIELDS.map((f) => (f === 'deadline_days' && merged[f] !== null ? Number(merged[f]) : merged[f])),
      existing.id],
  );
  delete row.tsv;
  res.json(row);
});

// The review steps. One set of routes for each kind of record so they cannot drift apart.
const TABLES = { providers: ['providers', 'provider'], routes: ['matter_routes', 'route'] };

for (const [segment, [table, recordType]] of Object.entries(TABLES)) {
  const noun = recordType === 'provider' ? 'directory entries' : 'routes';
  // Only directory entries have a check date. Verifying one dates the check.
  const extra = recordType === 'provider' ? ', last_checked_at = CURRENT_DATE' : '';

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
      `UPDATE ${table} SET status='published', verified_by=$1, verified_at=now(), updated_at=now()${extra}
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

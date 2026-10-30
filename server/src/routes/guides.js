// Guides: legal information in simple words, written and published by the admin.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { recordReview } from './reviewSteps.js';
import { validateService } from '../services/guideService.js';
import { DOMAINS, normalizeDomain } from '../services/domains.js';

const router = Router();

// The areas of law live in services/domains.js. They are exported here as well because the tests
// and the older code import them from this file.
export { DOMAINS };

const SECTIONS = ['situation', 'law_says', 'your_rights', 'steps', 'get_help'];
const REQUIRED = ['title', ...SECTIONS, 'source_law'];
const MAX_TITLE = 200;
const MAX_SECTION = 20000;
const MAX_SUMMARY = 280;

const clean = (v) => (typeof v === 'string' ? v.trim() : v);

// What a reader sees. The columns are listed one by one. The row also has verified_by, which is
// an internal account id. Nobody is named to the reader.
const PUBLIC_COLUMNS = `g.id, g.domain, g.title, g.situation, g.law_says, g.your_rights, g.steps,
  g.get_help, g.source_law, g.source_url, g.summary, g.service, g.verified_at`;

// What the admin sees. This is the only read that returns drafts. review_comment is the reason on
// the latest review, such as why a guide was withdrawn.
const STAFF_COLUMNS = `g.id, g.domain, g.title, g.situation, g.law_says, g.your_rights, g.steps,
  g.get_help, g.source_law, g.source_url, g.summary, g.service, g.status, g.verified_at, g.created_at, g.updated_at,
  (SELECT dr.comment FROM directory_reviews dr
    WHERE dr.record_type = 'guide' AND dr.record_id = g.id
    ORDER BY dr.id DESC LIMIT 1) AS review_comment`;

const staffGuide = async (id) => (await q(
  `SELECT ${STAFF_COLUMNS} FROM guides g WHERE g.id = $1`, [id]))[0];

// Returns a message for the first problem found or null. It runs on the merged guide.
// It runs before anything is written so a mistake can never take a published guide off the site
// and save nothing in exchange.
function guideError(g) {
  if (!DOMAINS.includes(g.domain)) return `Unknown area of law. Use one of: ${DOMAINS.join(', ')}`;
  const missing = REQUIRED.filter((f) => typeof g[f] !== 'string' || !g[f]);
  if (missing.length) return `Missing template fields: ${missing.join(', ')}`;
  if (g.title.length > MAX_TITLE) return `title must be ${MAX_TITLE} characters or fewer`;
  const tooLong = SECTIONS.find((f) => g[f].length > MAX_SECTION);
  if (tooLong) return `${tooLong} must be ${MAX_SECTION} characters or fewer`;
  if (g.source_url) {
    // The address is shown as a link. A link like javascript:... would run a script when clicked.
    let url;
    try { url = new URL(String(g.source_url)); } catch { return 'source_url must be a full https:// address'; }
    if (url.protocol !== 'https:') return 'source_url must start with https://';
  }
  // A number, a list or an object is not a summary. It would reach the database as odd text.
  if (g.summary != null && typeof g.summary !== 'string') return 'summary must be text';
  if (g.summary && g.summary.length > MAX_SUMMARY) return `summary must be ${MAX_SUMMARY} characters or fewer`;
  return null;
}

// ------------------------------------------------------------------------------ public

// GET /api/guides?search=&domain= : published guides only, as cards without the full text.
router.get('/', async (req, res) => {
  const params = [];
  let where = `g.status = 'published'`;
  if (typeof req.query.domain === 'string' && req.query.domain) {
    params.push(normalizeDomain(req.query.domain));
    where += ` AND g.domain = $${params.length}`;
  }
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    // Words like "the" are dropped by the search. A search made only of them finds nothing.
    params.push(req.query.search.trim().slice(0, 200));
    where += ` AND to_tsvector('english', g.title || ' ' || g.situation || ' ' || g.law_says)
                   @@ plainto_tsquery('english', $${params.length})`;
  }
  res.json(await q(
    `SELECT g.id, g.domain, g.title, g.source_law, g.summary, g.verified_at,
            (g.service IS NOT NULL) AS has_service
       FROM guides g
      WHERE ${where}
      ORDER BY g.verified_at DESC NULLS LAST, g.id`,
    params));
});

// ------------------------------------------------------------------------------ staff

// GET /api/guides/all : every guide in every state. It is declared before /:id because that
// route answers 404 for an id that is not a number and would swallow the word "all".
router.get('/all', requireAuth('admin'), async (_req, res) => {
  res.json(await q(
    `SELECT ${STAFF_COLUMNS} FROM guides g
      ORDER BY g.updated_at DESC, g.id`));
});

// GET /api/guides/:id : the full guide. A guide that is a draft or was never published is a
// 404, the same as one that does not exist — a direct link teaches nothing. A withdrawn guide
// was public knowledge, so it answers 410 with the reason instead, not a bare 404.
router.get('/:id', requireIntParam('id'), async (req, res) => {
  const [row] = await q('SELECT status FROM guides WHERE id = $1', [req.params.id]);
  if (!row || (row.status !== 'published' && row.status !== 'withdrawn')) {
    return res.status(404).json({ error: 'Guide not found' });
  }
  if (row.status === 'withdrawn') {
    const [review] = await q(
      `SELECT comment FROM directory_reviews WHERE record_type = 'guide' AND record_id = $1 AND decision = 'withdrawn'
        ORDER BY id DESC LIMIT 1`, [req.params.id]);
    return res.status(410).json({ error: review?.comment || 'This guide has been withdrawn.' });
  }
  const [guide] = await q(
    `SELECT ${PUBLIC_COLUMNS} FROM guides g
      WHERE g.id = $1 AND g.status = 'published'`, [req.params.id]);
  if (!guide) return res.status(404).json({ error: 'Guide not found' });
  res.json(guide);
});

// ------------------------------------------------------------------------------ admin

// POST /api/guides : the admin writes a draft. Publishing is never a field the admin can send.
router.post('/', requireAuth('admin'), async (req, res) => {
  const b = req.body || {};
  const guide = {
    domain: normalizeDomain(b.domain),
    source_url: clean(b.source_url) || null,
    summary: clean(b.summary) || null,
  };
  for (const f of REQUIRED) guide[f] = clean(b[f]);
  const error = guideError(guide);
  if (error) return res.status(400).json({ error });
  const checked = validateService(b.service);
  if (checked.errors) return res.status(400).json({ error: `Service details: ${checked.errors.join('; ')}` });

  const [row] = await q(
    `INSERT INTO guides (domain, title, situation, law_says, your_rights, steps, get_help, source_law, source_url, service, summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [guide.domain, guide.title, guide.situation, guide.law_says, guide.your_rights, guide.steps,
     guide.get_help, guide.source_law, guide.source_url, checked.value, guide.summary]);
  res.status(201).json(await staffGuide(row.id));
});

// PUT /api/guides/:id : the admin edits a guide. Any edit sends it back to draft and clears the
// publish stamp. A key the request did not send keeps its value. source_url can be cleared by
// sending null.
router.put('/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [existing] = await q('SELECT * FROM guides WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Guide not found' });

  const has = (k) => Object.prototype.hasOwnProperty.call(req.body || {}, k);
  const merged = {};
  for (const f of REQUIRED) merged[f] = has(f) ? clean(req.body[f]) : existing[f];
  merged.domain = has('domain') ? normalizeDomain(req.body.domain) : existing.domain;
  merged.source_url = has('source_url') ? (clean(req.body.source_url) || null) : existing.source_url;
  merged.summary = has('summary') ? (clean(req.body.summary) || null) : existing.summary;

  const error = guideError(merged);
  if (error) return res.status(400).json({ error });
  // The service block follows the same rule as the other keys. Left out keeps it. Sent as null clears it.
  // It is checked before the update below. That update takes a published guide off the site.
  const checked = validateService(has('service') ? req.body.service : existing.service);
  if (checked.errors) return res.status(400).json({ error: `Service details: ${checked.errors.join('; ')}` });

  await q(
    `UPDATE guides SET domain=$1, title=$2, situation=$3, law_says=$4, your_rights=$5, steps=$6,
            get_help=$7, source_law=$8, source_url=$9, service=$10, summary=$11,
            status='draft', verified_by=NULL, verified_at=NULL, updated_at=now()
      WHERE id=$12`,
    [merged.domain, merged.title, merged.situation, merged.law_says, merged.your_rights, merged.steps,
     merged.get_help, merged.source_law, merged.source_url, checked.value, merged.summary,
     existing.id]);
  res.json(await staffGuide(existing.id));
});

// POST /api/guides/:id/publish : the admin publishes a draft directly.
router.post('/:id/publish', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [row] = await q(
    `UPDATE guides SET status = 'published', verified_by = $1, verified_at = now(), updated_at = now()
      WHERE id = $2 AND status <> 'published' RETURNING id, status`,
    [req.user.id, req.params.id]);
  if (!row) return res.status(400).json({ error: 'That guide could not be found or is already published' });
  await recordReview('guide', row.id, req.user.id, 'published');
  res.json(row);
});

// POST /api/guides/:id/withdraw { comment } : the admin pulls a published guide off the site. A
// reason is required.
router.post('/:id/withdraw', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
  if (!comment) return res.status(400).json({ error: 'Say why this guide is being withdrawn.' });
  const [row] = await q(
    `UPDATE guides SET status = 'withdrawn', verified_by = NULL, verified_at = NULL, updated_at = now()
      WHERE id = $1 AND status = 'published' RETURNING id, status`,
    [req.params.id]);
  if (!row) return res.status(400).json({ error: 'Only a published guide can be withdrawn' });
  await recordReview('guide', row.id, req.user.id, 'withdrawn', comment);
  res.json(row);
});

export default router;

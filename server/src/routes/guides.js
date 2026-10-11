// Guides: plain-language legal information that a legal expert has verified.
//
// A guide follows the same steps as a directory entry.
//   draft -> pending_review -> published      only a legal expert publishes
//   published --(any edit)--> draft, stamp cleared
// The integrity rule is the heart of the platform. A reader must never see text that no legal
// expert checked. So any edit to a published guide takes it off the site at once and it comes
// back only when an expert verifies it again.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { addReviewSteps } from './reviewSteps.js';

const router = Router();

// The areas of law. The database has the same list in a CHECK. The client has a filter button
// for each one so the three lists must agree.
export const DOMAINS = ['tenancy', 'employment', 'business', 'immigration', 'harassment'];

const SECTIONS = ['situation', 'law_says', 'your_rights', 'steps', 'get_help'];
const REQUIRED = ['title', ...SECTIONS, 'source_law'];
const MAX_TITLE = 200;
const MAX_SECTION = 20000;

const clean = (v) => (typeof v === 'string' ? v.trim() : v);
const normalizeDomain = (value) => String(value ?? '').trim().toLowerCase();

// What a reader sees. The columns are listed one by one. The row also has verified_by, which is
// an internal account id. The name of the expert is shown instead.
const PUBLIC_COLUMNS = `g.id, g.domain, g.title, g.situation, g.law_says, g.your_rights, g.steps,
  g.get_help, g.source_law, g.source_url, g.verified_at, vu.name AS verified_by_name`;

// What staff see. This is the only read that returns drafts. An expert must be able to read
// the text before verifying it. review_comment is the comment on the latest review. It is empty
// after a verification so an old return stops showing by itself.
const STAFF_COLUMNS = `g.id, g.domain, g.title, g.situation, g.law_says, g.your_rights, g.steps,
  g.get_help, g.source_law, g.source_url, g.status, g.verified_at, g.created_at, g.updated_at,
  vu.name AS verified_by_name,
  (SELECT dr.comment FROM directory_reviews dr
    WHERE dr.record_type = 'guide' AND dr.record_id = g.id
    ORDER BY dr.id DESC LIMIT 1) AS review_comment`;

const staffGuide = async (id) => (await q(
  `SELECT ${STAFF_COLUMNS} FROM guides g LEFT JOIN users vu ON vu.id = g.verified_by WHERE g.id = $1`, [id]))[0];

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
    `SELECT g.id, g.domain, g.title, g.source_law, g.verified_at, vu.name AS verified_by_name
       FROM guides g LEFT JOIN users vu ON vu.id = g.verified_by
      WHERE ${where}
      ORDER BY g.verified_at DESC NULLS LAST, g.id`,
    params));
});

// ------------------------------------------------------------------------------ staff

// GET /api/guides/all : every guide in every state. It is declared before /:id because that
// route answers 404 for an id that is not a number and would swallow the word "all".
router.get('/all', requireAuth('admin', 'legal_expert'), async (_req, res) => {
  res.json(await q(
    `SELECT ${STAFF_COLUMNS} FROM guides g LEFT JOIN users vu ON vu.id = g.verified_by
      ORDER BY g.updated_at DESC, g.id`));
});

// GET /api/guides/:id : the full guide. A guide that is not published is a 404 for everyone.
router.get('/:id', requireIntParam('id'), async (req, res) => {
  const [guide] = await q(
    `SELECT ${PUBLIC_COLUMNS} FROM guides g LEFT JOIN users vu ON vu.id = g.verified_by
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
  };
  for (const f of REQUIRED) guide[f] = clean(b[f]);
  const error = guideError(guide);
  if (error) return res.status(400).json({ error });

  const [row] = await q(
    `INSERT INTO guides (domain, title, situation, law_says, your_rights, steps, get_help, source_law, source_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [guide.domain, guide.title, guide.situation, guide.law_says, guide.your_rights, guide.steps,
     guide.get_help, guide.source_law, guide.source_url]);
  res.status(201).json(await staffGuide(row.id));
});

// PUT /api/guides/:id : the admin edits a guide. THE INTEGRITY RULE.
// Any edit sends the guide back to draft and clears the stamp. A key the request did not send
// keeps its value. source_url can be cleared by sending null.
router.put('/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [existing] = await q('SELECT * FROM guides WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Guide not found' });

  const has = (k) => Object.prototype.hasOwnProperty.call(req.body || {}, k);
  const merged = {};
  for (const f of REQUIRED) merged[f] = has(f) ? clean(req.body[f]) : existing[f];
  merged.domain = has('domain') ? normalizeDomain(req.body.domain) : existing.domain;
  merged.source_url = has('source_url') ? (clean(req.body.source_url) || null) : existing.source_url;

  const error = guideError(merged);
  if (error) return res.status(400).json({ error });

  await q(
    `UPDATE guides SET domain=$1, title=$2, situation=$3, law_says=$4, your_rights=$5, steps=$6,
            get_help=$7, source_law=$8, source_url=$9,
            status='draft', verified_by=NULL, verified_at=NULL, updated_at=now()
      WHERE id=$10`,
    [merged.domain, merged.title, merged.situation, merged.law_says, merged.your_rights, merged.steps,
     merged.get_help, merged.source_law, merged.source_url, existing.id]);
  res.json(await staffGuide(existing.id));
});

// submit (admin), verify (legal expert) and return (legal expert, with a reason).
// The paths are /api/guides/:id/submit and so on.
addReviewSteps(router, { segment: '', table: 'guides', recordType: 'guide', noun: 'guides' });

export default router;

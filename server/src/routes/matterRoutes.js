// Where to go: for each kind of matter the body that must hear it first, the law that says so,
// the steps after that and the deadline.
//
// This is a lookup against rows an admin checked and published. No language model is used. The body a
// person must go to first and the deadline are facts that somebody checked. They are not text
// that somebody generated.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam, isValidId } from '../middleware/validate.js';
import { searchRoutes } from '../services/routing.js';
import { PUBLIC_PROVIDER_COLUMNS } from './directory.js';
import { DOMAINS, normalizeDomain } from '../services/domains.js';
import { recordReview } from './reviewSteps.js';

const router = Router();

const ROUTE_FIELDS = [
  'matter_type', 'title', 'keywords', 'first_forum_id', 'legal_basis', 'exclusions', 'steps',
  'deadline_days', 'deadline_runs_from', 'deadline_note', 'area',
];

const clean = (v) => (typeof v === 'string' ? v.trim() : v);

// An empty area means none. Text is lower-cased. Anything else is kept as it is so the check below
// refuses it. A number or a list must not be turned into "none" without a word.
const areaFrom = (v) => (typeof v === 'string' ? normalizeDomain(v) || null : (v ?? null));

function stepsFrom(value) {
  if (!Array.isArray(value)) return null;
  return value.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
}

// Returns a message for the first problem found or null. It runs on the merged row so a
// partial edit is checked as the route it would become.
function routeError(r) {
  if (!r.matter_type || !/^[a-z0-9_]{3,60}$/.test(r.matter_type)) {
    return 'matter_type must be 3 to 60 lowercase letters, digits or underscores';
  }
  if (!r.title) return 'title is required. It is the situation in the words a reader would use';
  if (!r.legal_basis) return 'legal_basis is required. It is the article that sends this matter there';
  if (!isValidId(r.first_forum_id)) return 'first_forum_id must name a directory entry';
  if (!Array.isArray(r.steps) || r.steps.length === 0) return 'steps must list at least one step';
  const hasDays = r.deadline_days !== null && r.deadline_days !== undefined && r.deadline_days !== '';
  const hasFrom = Boolean(r.deadline_runs_from);
  if (hasDays !== hasFrom) {
    return 'A deadline needs both a number of days and what it runs from. Or neither';
  }
  if (hasDays && !(Number.isInteger(Number(r.deadline_days)) && Number(r.deadline_days) > 0)) {
    return 'deadline_days must be a whole number of days greater than zero';
  }
  if (r.area !== null && r.area !== undefined && !DOMAINS.includes(r.area)) {
    return `area must be one of: ${DOMAINS.join(', ')}`;
  }
  return null;
}

const daysValue = (r) => (r.deadline_days !== null && r.deadline_days !== undefined ? Number(r.deadline_days) : null);

// ------------------------------------------------------------------------------ public

// GET /api/directory/routes?q=...
// Every matter a reader can pick. With q it returns the matters whose wording matches what
// they typed. The best match comes first. With area it keeps one area of law.
router.get('/routes', async (req, res) => {
  res.json(await searchRoutes(
    typeof req.query.q === 'string' ? req.query.q : '',
    typeof req.query.area === 'string' ? req.query.area : '',
  ));
});

// ------------------------------------------------------------------------------ staff

// GET /api/directory/routes/all: every route in every state. It shows the name and the state
// of the office so a reviewer can see when a route is ready but its office is not.
// It must be declared before /routes/:id. That route answers 404 for an id that is not a
// number and would swallow the word "all".
router.get('/routes/all', requireAuth('admin'), async (_req, res) => {
  res.json(await q(
    `SELECT r.id, r.matter_type, r.title, r.keywords, r.first_forum_id, r.legal_basis,
            r.exclusions, r.steps, r.deadline_days, r.deadline_runs_from, r.deadline_note, r.area,
            r.status, r.verified_at, r.updated_at,
            p.name AS first_forum_name, p.status AS first_forum_status
       FROM matter_routes r
       JOIN providers p ON p.id = r.first_forum_id
      ORDER BY r.updated_at DESC, r.id`));
});

// GET /api/directory/routes/:id: the whole answer for one matter.
router.get('/routes/:id', requireIntParam('id'), async (req, res) => {
  const [route] = await q(
    `SELECT r.id, r.matter_type, r.title, r.legal_basis, r.exclusions, r.steps,
            r.deadline_days, r.deadline_runs_from, r.deadline_note,
            r.verified_at, r.first_forum_id
       FROM matter_routes r
      WHERE r.id = $1 AND r.status = 'published'`,
    [req.params.id],
  );
  if (!route) return res.status(404).json({ error: 'That matter is not in the directory' });
  const [forum] = await q(
    `SELECT ${PUBLIC_PROVIDER_COLUMNS}
       FROM providers p
      WHERE p.id = $1 AND p.status = 'published'`,
    [route.first_forum_id],
  );
  // The same rule as the list. Never hand over a route whose office nobody has checked.
  if (!forum) return res.status(404).json({ error: 'That matter is not in the directory' });
  delete route.first_forum_id;
  res.json({ ...route, first_forum: forum });
});

// ------------------------------------------------------------------------------ admin

// A new route always starts as a draft. Publishing is the admin's act.
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
    area: areaFrom(b.area),
  };
  const error = routeError(r);
  if (error) return res.status(400).json({ error });
  const [forum] = await q('SELECT id FROM providers WHERE id = $1', [r.first_forum_id]);
  if (!forum) return res.status(400).json({ error: 'first_forum_id must name a directory entry' });
  const [duplicate] = await q('SELECT id FROM matter_routes WHERE matter_type = $1', [r.matter_type]);
  if (duplicate) return res.status(409).json({ error: 'A route for that matter_type already exists' });

  const [row] = await q(
    `INSERT INTO matter_routes (${ROUTE_FIELDS.join(',')})
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    ROUTE_FIELDS.map((f) => (f === 'deadline_days' ? daysValue(r) : r[f])),
  );
  delete row.tsv;
  res.status(201).json(row);
});

// PUT /api/directory/routes/:id
// Any edit sends the route back to draft and clears the stamp. Every field of a route is a
// checked fact (where to go, why, what next and by when) so no field is exempt.
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
  // Capitals and spaces in an area do not matter, as with the area of a guide.
  if (typeof merged.area === 'string') merged.area = normalizeDomain(merged.area) || null;

  const error = routeError(merged);
  if (error) return res.status(400).json({ error });
  if (merged.first_forum_id !== existing.first_forum_id) {
    const [forum] = await q('SELECT id FROM providers WHERE id = $1', [merged.first_forum_id]);
    if (!forum) return res.status(400).json({ error: 'first_forum_id must name a directory entry' });
  }
  if (merged.matter_type !== existing.matter_type) {
    const [duplicate] = await q('SELECT id FROM matter_routes WHERE matter_type = $1 AND id <> $2',
      [merged.matter_type, existing.id]);
    if (duplicate) return res.status(409).json({ error: 'A route for that matter_type already exists' });
  }

  const [row] = await q(
    `UPDATE matter_routes SET matter_type=$1, title=$2, keywords=$3, first_forum_id=$4,
            legal_basis=$5, exclusions=$6, steps=$7, deadline_days=$8, deadline_runs_from=$9,
            deadline_note=$10, area=$11, status='draft', verified_by=NULL, verified_at=NULL, updated_at=now()
      WHERE id=$12 RETURNING *`,
    [...ROUTE_FIELDS.map((f) => (f === 'deadline_days' ? daysValue(merged) : merged[f])), existing.id],
  );
  delete row.tsv;
  res.json(row);
});

router.post('/routes/:id/publish', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [row] = await q(
    `UPDATE matter_routes SET status = 'published', verified_by = $1, verified_at = now(), updated_at = now()
      WHERE id = $2 AND status <> 'published' RETURNING id, status`,
    [req.user.id, req.params.id]);
  if (!row) return res.status(400).json({ error: 'That route could not be found or is already published' });
  await recordReview('route', row.id, req.user.id, 'published');
  res.json(row);
});

export default router;

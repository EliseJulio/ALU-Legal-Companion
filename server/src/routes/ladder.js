// The dispute ladder: the steps a person takes for a dispute before court. The steps are data
// an admin writes and publishes one at a time. Only published steps are public.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { LADDER_FIELDS, cleanText, ladderError, positionFrom } from '../services/ladder.js';

const router = Router();

const PUBLIC_COLUMNS = 'id, position, title, tagline, description, law_cited';

// GET /api/directory/ladder: the published steps in order. Nothing else.
router.get('/ladder', async (_req, res) => {
  res.json(await q(
    `SELECT ${PUBLIC_COLUMNS} FROM dispute_ladder_steps
      WHERE status = 'published' ORDER BY position, id`));
});

// GET /api/directory/ladder/all: every step with its status. It is declared before /ladder/:id.
router.get('/ladder/all', requireAuth('admin'), async (_req, res) => {
  res.json(await q(
    `SELECT id, position, title, tagline, description, law_cited, status, updated_at
       FROM dispute_ladder_steps ORDER BY position, id`));
});

// POST /api/directory/ladder: a new step. It starts as a draft.
router.post('/ladder', requireAuth('admin'), async (req, res) => {
  const b = req.body || {};
  const step = {
    position: positionFrom(b.position),
    title: cleanText(b.title),
    tagline: cleanText(b.tagline),
    description: cleanText(b.description),
    law_cited: cleanText(b.law_cited),
  };
  const error = ladderError(step);
  if (error) return res.status(400).json({ error });
  const [row] = await q(
    `INSERT INTO dispute_ladder_steps (position, title, tagline, description, law_cited)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, position, title, tagline, description, law_cited, status, updated_at`,
    [step.position, step.title, step.tagline, step.description, step.law_cited]);
  res.status(201).json(row);
});

// PUT /api/directory/ladder/:id: a field left out keeps its value. Any edit sends the step back to
// draft, so the public page never shows text that changed after it was published.
router.put('/ladder/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [existing] = await q('SELECT * FROM dispute_ladder_steps WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Step not found' });

  const body = req.body || {};
  const merged = {};
  for (const field of LADDER_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) {
      merged[field] = existing[field];
      continue;
    }
    merged[field] = field === 'position' ? positionFrom(body[field]) : cleanText(body[field]);
  }
  const error = ladderError(merged);
  if (error) return res.status(400).json({ error });

  const [row] = await q(
    `UPDATE dispute_ladder_steps
        SET position = $1, title = $2, tagline = $3, description = $4, law_cited = $5,
            status = 'draft', updated_at = now()
      WHERE id = $6
      RETURNING id, position, title, tagline, description, law_cited, status, updated_at`,
    [merged.position, merged.title, merged.tagline, merged.description, merged.law_cited, existing.id]);
  res.json(row);
});

// POST /api/directory/ladder/:id/publish: only a draft can be published.
router.post('/ladder/:id/publish', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [row] = await q(
    `UPDATE dispute_ladder_steps SET status = 'published', updated_at = now()
      WHERE id = $1 AND status <> 'published' RETURNING id, status`,
    [req.params.id]);
  if (!row) return res.status(400).json({ error: 'That step could not be found or is already published' });
  res.json(row);
});

// DELETE /api/directory/ladder/:id: removes a step. A published step leaves the public page at once.
router.delete('/ladder/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [row] = await q('DELETE FROM dispute_ladder_steps WHERE id = $1 RETURNING id', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Step not found' });
  res.json({ id: row.id });
});

export default router;

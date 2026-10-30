// Document checklists.
//   the admin writes a draft and publishes it directly
// Any edit to a published checklist sends it back to draft.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { validateChecklist } from '../services/checklists.js';

const router = Router();

const PUBLIC = `c.id, c.slug, c.title, c.description, c.items, c.verified_at`;

// A slug that is already used is the caller's mistake. It is not a fault of the server.
const slugTaken = (err) => err?.code === '23505';

// GET /api/checklists : published only. The id, the title, the description and how many documents.
router.get('/', async (_req, res) => {
  res.json(await q(
    `SELECT c.id, c.slug, c.title, c.description, jsonb_array_length(c.items)::int AS item_count, c.verified_at
       FROM document_checklists c WHERE c.status = 'published' ORDER BY c.title`));
});

// GET /api/checklists/all : every checklist in every state. Only the admin editor
// uses it. It is declared before /:id. That route would take the word "all" otherwise.
router.get('/all', requireAuth('admin'), async (_req, res) => {
  res.json(await q(
    `SELECT c.* FROM document_checklists c ORDER BY c.updated_at DESC, c.id`));
});

// GET /api/checklists/:id : published only. A draft is a 404 as it is for guides.
router.get('/:id', requireIntParam('id'), async (req, res) => {
  const [c] = await q(
    `SELECT ${PUBLIC} FROM document_checklists c
      WHERE c.id = $1 AND c.status = 'published'`, [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Checklist not found' });
  res.json(c);
});

// POST /api/checklists : the admin writes a draft.
router.post('/', requireAuth('admin'), async (req, res) => {
  const checked = validateChecklist(req.body);
  if (checked.errors) return res.status(400).json({ error: checked.errors.join('; ') });
  const { slug, title, description, items } = checked.value;
  try {
    const [c] = await q(
      `INSERT INTO document_checklists (slug, title, description, items) VALUES ($1,$2,$3,$4) RETURNING *`,
      [slug, title, description ?? null, JSON.stringify(items)]);
    res.status(201).json(c);
  } catch (err) {
    if (slugTaken(err)) return res.status(409).json({ error: 'A checklist with that name already exists.' });
    throw err;
  }
});

// PUT /api/checklists/:id : the admin edits. THE INTEGRITY RULE.
// Any edit to a draft or to a published list leaves it a draft with no verification. A field the
// request left out keeps its value. The merged result is checked before the update. So a typo
// cannot take a published checklist off the site and then fail.
router.put('/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [existing] = await q('SELECT * FROM document_checklists WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Checklist not found' });
  const merged = {
    slug: req.body?.slug ?? existing.slug,
    title: req.body?.title ?? existing.title,
    description: req.body?.description ?? existing.description ?? undefined,
    items: req.body?.items ?? existing.items,
  };
  const checked = validateChecklist(merged);
  if (checked.errors) return res.status(400).json({ error: checked.errors.join('; ') });
  const { slug, title, description, items } = checked.value;
  try {
    const [c] = await q(
      `UPDATE document_checklists
          SET slug=$1, title=$2, description=$3, items=$4,
              status='draft', verified_by=NULL, verified_at=NULL, updated_at=now()
        WHERE id=$5 RETURNING *`,
      [slug, title, description ?? null, JSON.stringify(items), existing.id]);
    res.json(c);
  } catch (err) {
    if (slugTaken(err)) return res.status(409).json({ error: 'A checklist with that name already exists.' });
    throw err;
  }
});

// POST /api/checklists/:id/publish : the admin publishes a draft directly.
router.post('/:id/publish', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [c] = await q(
    `UPDATE document_checklists
        SET status='published', verified_by=$1, verified_at=now(), review_comment=NULL, updated_at=now()
      WHERE id=$2 AND status <> 'published' RETURNING *`, [req.user.id, req.params.id]);
  if (!c) return res.status(400).json({ error: 'That checklist could not be found or is already published' });
  res.json(c);
});

export default router;

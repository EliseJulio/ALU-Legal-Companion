// Saved guides for signed-in students and staff.
// This router is mounted at /api so it can serve both /api/bookmarks and /api/guides/:id/bookmark.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';

const router = Router();
const OWNERS = ['student', 'staff'];

// GET /api/bookmarks : the caller's saved guides, newest first.
// Only published guides are listed. When an admin edits a saved guide it goes back to draft and
// leaves this list. The save is kept so it comes back once an expert verifies the guide again.
// Only the card fields are returned. This is a list. The full text of every saved guide
// would be a large download for text nobody is reading yet.
router.get('/bookmarks', requireAuth(...OWNERS), async (req, res) => {
  res.json(await q(
    `SELECT g.id, g.domain, g.title, g.source_law, g.verified_at,
            u.name AS verified_by_name, b.created_at AS bookmarked_at
       FROM bookmarks b
       JOIN guides g ON g.id = b.guide_id AND g.status = 'published'
       LEFT JOIN users u ON u.id = g.verified_by
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC`,
    [req.user.id]));
});

// POST /api/guides/:id/bookmark : save a guide.
// Only a published guide can be saved. The 404 matches what GET /api/guides/:id says for a
// draft. A different answer would let a caller find out which guides exist but are not verified.
// Saving twice is not an error. A person who taps the button twice on a slow connection should
// not have to read about it.
router.post('/guides/:id/bookmark', requireAuth(...OWNERS), requireIntParam('id'), async (req, res) => {
  const [guide] = await q(`SELECT id FROM guides WHERE id = $1 AND status = 'published'`, [req.params.id]);
  if (!guide) return res.status(404).json({ error: 'Guide not found' });
  await q(
    `INSERT INTO bookmarks (user_id, guide_id) VALUES ($1, $2) ON CONFLICT (user_id, guide_id) DO NOTHING`,
    [req.user.id, guide.id]);
  res.status(201).json({ guide_id: guide.id, bookmarked: true });
});

// DELETE /api/guides/:id/bookmark : remove a save. It only touches the caller's own row.
router.delete('/guides/:id/bookmark', requireAuth(...OWNERS), requireIntParam('id'), async (req, res) => {
  const removed = await q(
    'DELETE FROM bookmarks WHERE user_id = $1 AND guide_id = $2 RETURNING id', [req.user.id, req.params.id]);
  if (!removed.length) return res.status(404).json({ error: 'You have not saved this guide' });
  res.status(204).end();
});

export default router;

// The list of saved guides for signed-in students and staff.
// Saving and removing a guide is in routes/guides.js because those act on a guide
// (/api/guides/:id/bookmark). This file only lists.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/bookmarks: the caller's saved guides, newest first.
// A guide that is no longer published is left out. An edited guide goes back to draft under
// the integrity rule, so it must not show here until a legal expert verifies it again. The
// saved row is kept, so it returns by itself.
// Only the card fields are sent not the five template sections. This is a list and the
// full text of every saved guide would be a large download for nothing.
router.get('/', requireAuth('student', 'staff'), async (req, res) => {
  res.json(await q(
    `SELECT g.id, g.domain, g.title, g.source_law, g.verified_at,
            u.name AS verified_by_name, b.created_at AS bookmarked_at
       FROM bookmarks b
       JOIN guides g ON g.id = b.guide_id AND g.status = 'published'
       LEFT JOIN users u ON u.id = g.verified_by
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC`,
    [req.user.id],
  ));
});

export default router;

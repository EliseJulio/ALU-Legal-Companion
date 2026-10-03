// Public routes that do not belong to a bigger group: the public directory.
// The assistant and the emergency contacts are added here later.
import { Router } from 'express';
import { q } from '../db.js';
import { PUBLIC_PROVIDER_COLUMNS } from './directory.js';

const router = Router();

// GET /api/providers: the public directory. Published entries only.
// Each entry shows the date it was last checked, who verified it and `stale` if that check
// is more than 180 days old.
// Optional filters: ?type=, ?free=true, ?q= (searches the name, place and services).
router.get('/providers', async (req, res) => {
  const params = [];
  let where = `p.status = 'published'`;
  if (typeof req.query.type === 'string' && req.query.type) {
    params.push(req.query.type); where += ` AND p.type = $${params.length}`;
  }
  if (req.query.free === 'true') where += ' AND p.is_free';
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    params.push(`%${req.query.q.trim().slice(0, 100)}%`);
    where += ` AND (p.name ILIKE $${params.length} OR p.location ILIKE $${params.length}
                    OR p.services ILIKE $${params.length})`;
  }
  res.json(await q(
    `SELECT ${PUBLIC_PROVIDER_COLUMNS}
       FROM providers p LEFT JOIN users vu ON vu.id = p.verified_by
      WHERE ${where}
      ORDER BY p.name`,
    params));
});

export default router;

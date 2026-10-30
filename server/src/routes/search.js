// Search over the published guides, matters and directory entries (FR-04, FR-01).
// Open to everyone. Nothing about who asked or what they typed is stored.
import { Router } from 'express';
import { searchLimiter } from '../middleware/rateLimit.js';
import { siteSearch, LIBRARIES, MIN_QUERY, MAX_QUERY } from '../services/siteSearch.js';

const router = Router();

// GET /api/search?q=deposit&library=all
// library is all (the default), guides, routes or providers.
router.get('/', searchLimiter, async (req, res, next) => {
  try {
    const text = typeof req.query.q === 'string' ? req.query.q.trim().replace(/\s+/g, ' ') : '';
    if (text.length < MIN_QUERY) {
      return res.status(400).json({ error: `Type at least ${MIN_QUERY} characters to search.` });
    }
    if (text.length > MAX_QUERY) {
      return res.status(400).json({ error: `Search words must be ${MAX_QUERY} characters or fewer.` });
    }
    const library = typeof req.query.library === 'string' && req.query.library ? req.query.library : 'all';
    if (library !== 'all' && !LIBRARIES.includes(library)) {
      return res.status(400).json({ error: `library must be one of: all, ${LIBRARIES.join(', ')}` });
    }
    const results = await siteSearch(text, library === 'all' ? LIBRARIES : [library]);
    return res.json({ query: text, results });
  } catch (err) {
    return next(err);
  }
});

export default router;

// Protected job endpoint. A scheduled workflow calls it every 10 minutes. The call wakes the hosting
// service and runs the due deadline reminders, the due consultation reminders and the retention
// purge. It returns counts only.
import crypto from 'node:crypto';
import { Router } from 'express';
import { createLimiter } from '../middleware/rateLimit.js';
import { runDueJobs } from '../services/dueJobs.js';

const router = Router();

const MIN_SECRET_LENGTH = 32;

const jobLimiter = createLimiter({
  max: 30,
  message: 'Too many job requests. Please wait and try again.',
});

// The route is off unless JOB_SECRET is long enough. When it is off the request moves on to the
// 404 handler, the same answer as any unknown path.
function jobsEnabled(_req, _res, next) {
  const expected = process.env.JOB_SECRET || '';
  // 'route' skips the rest of this route, so nothing below it runs.
  if (expected.length < MIN_SECRET_LENGTH) return next('route');
  return next();
}

// Compares the two secrets in constant time. The buffers must be the same length first.
function secretMatches(given, expected) {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireJobSecret(req, res, next) {
  if (!secretMatches(req.get('X-Job-Secret'), process.env.JOB_SECRET || '')) {
    return res.status(401).json({ error: 'The job secret is missing or wrong.' });
  }
  return next();
}

// The secret is checked before the limiter, so a request without it does not use up the budget.
router.post('/run-jobs', jobsEnabled, requireJobSecret, jobLimiter, async (_req, res) => {
  res.json(await runDueJobs());
});

export default router;

// Ask AI: a short answer from the published guides. It is open to everyone.
// Nothing about the asker is read or stored. Neither the question nor the answer is logged.
import { Router } from 'express';
import { askAiLimiter } from '../middleware/rateLimit.js';
import { askAi, config, AskAiUnavailable } from '../services/askAi.js';

const router = Router();

const UNAVAILABLE = 'Ask AI is not available right now.';
const MIN_QUESTION = 5;
const MAX_QUESTION = 500;

// GET /api/ask-ai/status : says only whether Ask AI can answer on this server.
router.get('/status', (_req, res) => {
  res.json({ available: config().available });
});

// POST /api/ask-ai { question } : a short answer or a plain message when no guide matches.
router.post('/', askAiLimiter, async (req, res, next) => {
  try {
    const raw = req.body?.question;
    const question = typeof raw === 'string' ? raw.trim() : '';
    if (!question) return res.status(400).json({ error: 'Write your question first.' });
    if (question.length < MIN_QUESTION) {
      return res.status(400).json({ error: `Your question must be at least ${MIN_QUESTION} characters.` });
    }
    if (question.length > MAX_QUESTION) {
      return res.status(400).json({ error: `Your question must be ${MAX_QUESTION} characters or fewer.` });
    }
    if (!config().available) return res.status(503).json({ error: UNAVAILABLE });
    return res.json(await askAi(question));
  } catch (err) {
    if (err instanceof AskAiUnavailable) return res.status(503).json({ error: UNAVAILABLE });
    return next(err);
  }
});

export default router;

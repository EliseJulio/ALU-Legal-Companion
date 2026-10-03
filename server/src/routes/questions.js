// Questions for legal experts. Anyone can ask, signed in or not. Experts answer from an inbox.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { questionTokenLimiter, questionSubmitLimiter } from '../middleware/rateLimit.js';
import { makeAnonToken } from '../services/anonToken.js';

const router = Router();

// POST /api/questions: a signed-in question is linked to the user. An anonymous one gets a
// token that is shown once. This route is open to everyone and writes data so it has its own
// limit. The limit is generous because a real anonymous reporter files one report or two.
router.post('/', questionSubmitLimiter, optionalAuth, async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Question text is required' });
  if (req.user) {
    const [question] = await q('INSERT INTO questions (user_id, text) VALUES ($1,$2) RETURNING id, text, status, created_at', [req.user.id, text.trim()]);
    return res.status(201).json(question);
  }
  const anon_token = makeAnonToken();
  const [question] = await q('INSERT INTO questions (anon_token, text) VALUES ($1,$2) RETURNING id, text, status, created_at', [anon_token, text.trim()]);
  res.status(201).json({ ...question, anon_token, warning: 'Save this token now — it is the only way to see the answer.' });
});

// GET /api/questions/mine
router.get('/mine', requireAuth('student', 'staff'), async (req, res) => {
  res.json(await q('SELECT id, text, answer, status, created_at FROM questions WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]));
});

// GET /api/questions/anon/:token
router.get('/anon/:token', questionTokenLimiter, async (req, res) => {
  const [question] = await q('SELECT id, text, answer, status, created_at FROM questions WHERE anon_token = $1', [req.params.token]);
  if (!question) return res.status(404).json({ error: 'No question found for this token' });
  res.json(question);
});

// GET /api/questions/open: the experts' inbox. It says only whether a question is anonymous.
router.get('/open', requireAuth('legal_expert'), async (_req, res) => {
  res.json(await q(
    `SELECT id, text, created_at, CASE WHEN user_id IS NULL THEN 'anonymous' ELSE 'signed-in' END AS kind
     FROM questions WHERE status = 'open' ORDER BY created_at ASC`));
});

// POST /api/questions/:id/answer: the first answer wins. A second one gets a 404.
router.post('/:id/answer', requireAuth('legal_expert'), requireIntParam('id'), async (req, res) => {
  const { answer } = req.body || {};
  if (!answer || !answer.trim()) return res.status(400).json({ error: 'Answer text is required' });
  const [question] = await q(
    `UPDATE questions SET answer = $1, answered_by = $2, status = 'answered' WHERE id = $3 AND status = 'open' RETURNING id, status`,
    [answer.trim(), req.user.id, req.params.id]);
  if (!question) return res.status(404).json({ error: 'Question not found or already answered' });
  res.json(question);
});

export default router;

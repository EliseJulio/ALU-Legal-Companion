// Questions for a legal expert. A person can ask in their own name or anonymously.
// An anonymous question stores no name and no account. It stores a hash of a random token.
// The person keeps the token and uses it to read the answer.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { newSubmitLimiter, newTokenLookupLimiter } from '../middleware/rateLimit.js';
import { makeAnonToken, normalizeAnonToken, hashAnonToken } from '../services/anonToken.js';

const router = Router();

// This route has its own limiters so other routes do not use up its budget.
const anonymousLimiter = newSubmitLimiter();
const tokenLimiter = newTokenLookupLimiter();

const MAX_QUESTION = 5000;
const MAX_ANSWER = 10000;

// The columns a person gets back about their own question.
const OWN_COLUMNS = 'id, text, answer, status, created_at';

// Returns the clean text or { error }.
function questionText(body) {
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return { error: 'Question text is required' };
  if (text.length > MAX_QUESTION) return { error: `Keep the question under ${MAX_QUESTION} characters` };
  return { text };
}

// POST /api/questions : a signed-in student or staff member asks in their own name.
router.post('/', requireAuth('student', 'staff'), async (req, res) => {
  const input = questionText(req.body);
  if (input.error) return res.status(400).json({ error: input.error });
  const [question] = await q(
    'INSERT INTO questions (user_id, text) VALUES ($1,$2) RETURNING id, text, status, created_at',
    [req.user.id, input.text]);
  res.status(201).json(question);
});

// POST /api/questions/anonymous : anyone can ask. No identity is stored and the token is shown once.
// It ignores any login. Even a signed-in person who uses this route stays anonymous.
router.post('/anonymous', anonymousLimiter, async (req, res) => {
  const input = questionText(req.body);
  if (input.error) return res.status(400).json({ error: input.error });
  const anonToken = makeAnonToken();
  const [question] = await q(
    'INSERT INTO questions (anon_token, text) VALUES ($1,$2) RETURNING id, text, status, created_at',
    [hashAnonToken(anonToken), input.text]);
  res.status(201).json({
    ...question,
    anon_token: anonToken,
    warning: 'Save this token now. It is the only way to see the answer and it cannot be recovered.',
  });
});

// GET /api/questions/mine
router.get('/mine', requireAuth('student', 'staff'), async (req, res) => {
  res.json(await q(
    `SELECT ${OWN_COLUMNS} FROM questions WHERE user_id = $1 ORDER BY created_at DESC, id DESC`, [req.user.id]));
});

// GET /api/questions/anon/:token : read the answer to an anonymous question. No login.
router.get('/anon/:token', tokenLimiter, async (req, res) => {
  const NOT_FOUND = { error: 'No question found for this token' };
  const token = normalizeAnonToken(req.params.token);
  if (!token) return res.status(404).json(NOT_FOUND);
  const [question] = await q(
    `SELECT ${OWN_COLUMNS} FROM questions WHERE anon_token = $1`, [hashAnonToken(token)]);
  if (!question) return res.status(404).json(NOT_FOUND);
  res.json(question);
});

// GET /api/questions/open : the inbox of the legal experts, oldest first.
// It says whether the question is anonymous and nothing more about who asked.
router.get('/open', requireAuth('legal_expert'), async (_req, res) => {
  res.json(await q(
    `SELECT id, text, created_at, CASE WHEN user_id IS NULL THEN 'anonymous' ELSE 'signed-in' END AS kind
       FROM questions WHERE status = 'open' ORDER BY created_at ASC, id ASC`));
});

// POST /api/questions/:id/answer : a legal expert answers an open question.
router.post('/:id/answer', requireAuth('legal_expert'), requireIntParam('id'), async (req, res) => {
  const answer = typeof req.body?.answer === 'string' ? req.body.answer.trim() : '';
  if (!answer) return res.status(400).json({ error: 'Answer text is required' });
  if (answer.length > MAX_ANSWER) return res.status(400).json({ error: `Keep the answer under ${MAX_ANSWER} characters` });
  // The status is in the WHERE so two experts cannot both answer the same question.
  const [question] = await q(
    `UPDATE questions SET answer = $1, answered_by = $2, status = 'answered'
      WHERE id = $3 AND status = 'open' RETURNING id, status`,
    [answer, req.user.id, req.params.id]);
  if (!question) return res.status(404).json({ error: 'Question not found or already answered' });
  res.json(question);
});

export default router;

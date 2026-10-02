// Auth routes: register, login and the signed-in user
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import {
  signToken, isAllowedEmail, normalizeEmail, ALLOWED_DOMAINS, BCRYPT_ROUNDS, requireAuth,
} from '../middleware/auth.js';

const router = Router();

// The user details that are safe to send to the browser. Never the password hash.
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

// POST /api/auth/register: students and staff only with an ALU email address
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password must be text' });
  }
  if (!['student', 'staff'].includes(role)) {
    return res.status(400).json({ error: 'Role must be student or staff. Legal experts join by invitation only.' });
  }
  if (!isAllowedEmail(email)) {
    return res.status(400).json({ error: `Sign-up is limited to the ALU community: ${ALLOWED_DOMAINS.map((d) => '@' + d).join(' or ')}` });
  }
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = await q('SELECT id FROM users WHERE email = $1', [normalizeEmail(email)]);
  if (existing.length) return res.status(400).json({ error: 'An account with this email already exists' });

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const [user] = await q(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
    [name, normalizeEmail(email), hash, role],
  );
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password must be text' });
  }

  const [user] = await q(
    'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
    [normalizeEmail(email)],
  );
  // Give the same answer for an unknown email and a wrong password. This way nobody can use
  // the login form to find out which emails have an account.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me: the signed-in user as they are in the database now. This can differ
// from the token if their role has changed.
router.get('/me', requireAuth(), async (req, res) => {
  const [user] = await q('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
  res.json({ ...publicUser(user), created_at: user.created_at });
});

export default router;

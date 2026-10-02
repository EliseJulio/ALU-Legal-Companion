// Login tokens and role checks
import jwt from 'jsonwebtoken';
import { q } from '../db.js';

// How strong the password hashing is. A bigger number makes password guessing slower.
// The number is saved inside each hash so old hashes still work if we change it.
export const BCRYPT_ROUNDS = 12;

const INSECURE_VALUES = new Set(['dev-secret', 'change-me-in-production']);

// Reads JWT_SECRET each time it is called so tests can change it. The server must stop if
// the secret is missing or weak, because anyone could then make a fake admin token.
export function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || INSECURE_VALUES.has(secret)) {
    throw new Error(
      'JWT_SECRET must be set to a random string of at least 32 characters. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return secret;
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    getSecret(),
    { expiresIn: '7d' },
  );
}

const bearer = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

// Checks the token then finds the user in the database. Returns null if the login is not valid.
// The role comes from the database not from the token. This way a role change works straight
// away even for tokens that were already given out.
async function resolveSession(req) {
  const token = bearer(req);
  if (!token) return null;

  let claims;
  try {
    claims = jwt.verify(token, getSecret());
  } catch {
    return null; // wrong signature, broken token or expired
  }

  const [user] = await q('SELECT id, name, role FROM users WHERE id = $1', [claims.id]);
  return user || null; // null if the account was deleted
}

// Needs a signed-in user. Pass roles to allow only those roles.
export function requireAuth(...roles) {
  return async (req, res, next) => {
    if (!bearer(req)) return res.status(401).json({ error: 'Login required' });

    const user = await resolveSession(req);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
    req.user = user;

    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that' });
    }
    next();
  };
}

// Only people with an ALU email can register.
export const ALLOWED_DOMAINS = ['alustudent.com', 'alueducation.com'];

// Writes an email the same way every time. Without this " A@alustudent.com" and
// "a@alustudent.com" could become two different accounts.
export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function isAllowedEmail(email) {
  // Needs exactly one @ with something before it. This stops "a@alustudent.com@gmail.com".
  const [local, domain, ...rest] = String(email).trim().toLowerCase().split('@');
  if (rest.length || !local || !domain) return false;
  return ALLOWED_DOMAINS.includes(domain);
}

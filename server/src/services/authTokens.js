// One-time tokens for the links we email. Today that is the email verification link.
//
// Two rules are kept here, so the routes cannot forget them:
//   1. Only a hash of the token is saved. The real token exists once, when it is made, and
//      is never saved or logged. If the database leaks, the rows are not usable as links.
//   2. A token only works for the purpose it was made for.
import crypto from 'node:crypto';
import { q } from '../db.js';

// The purposes the database allows. Checked here too, so a typo gives a clear error.
export const TOKEN_PURPOSES = ['verify_email'];

// SHA-256 is used instead of bcrypt. The token is 32 random bytes, so it cannot be guessed
// from a word list, and a plain hash lets us look it up quickly.
const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

// Makes a token, saves its hash and returns the real token.
// It lasts 24 hours: long enough to use, short enough that an old email stops working.
export async function issueToken(userId, purpose, ttlHours = 24) {
  if (!TOKEN_PURPOSES.includes(purpose)) throw new Error(`Unknown token purpose: ${purpose}`);
  const raw = crypto.randomBytes(32).toString('base64url');
  await q(
    `INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at)
     VALUES ($1, $2, $3, now() + ($4::int * interval '1 hour'))`,
    [userId, hashToken(raw), purpose, ttlHours],
  );
  return raw;
}

// Uses up a token. Returns its row, or null if it is unknown, already used, expired or made
// for another purpose. The caller only learns "no".
//
// One UPDATE checks and marks the token together. If two requests use the same link at once,
// only one of them gets a row back.
export async function consumeToken(raw, purpose) {
  if (!raw || !purpose) return null;
  const [row] = await q(
    `UPDATE auth_tokens
        SET used_at = now()
      WHERE token_hash = $1
        AND purpose    = $2
        AND used_at    IS NULL
        AND expires_at > now()
      RETURNING *`,
    [hashToken(raw), purpose],
  );
  return row || null;
}

// Says why a token was refused: 'unknown', 'used', 'expired' or 'valid'.
// Only use this where the person already holds the token (like the verify page). Never use it
// when they only gave an email address, because the answer would reveal who has an account.
export async function tokenStatus(raw, purpose) {
  if (!raw || !purpose) return 'unknown';
  const [row] = await q(
    `SELECT used_at IS NOT NULL AS used, expires_at <= now() AS expired
       FROM auth_tokens
      WHERE token_hash = $1 AND purpose = $2`,
    [hashToken(raw), purpose],
  );
  if (!row) return 'unknown';
  if (row.used) return 'used';
  if (row.expired) return 'expired';
  return 'valid';
}

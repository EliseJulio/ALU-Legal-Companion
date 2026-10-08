// One-time tokens for email links: verify an address and reset a password.
//
// Two rules are enforced here so no caller can forget them.
// 1. Only a hash is stored. A leaked reset token would let someone take over an account.
//    The raw token exists once as the result of issueToken(). It is never saved or logged.
// 2. A token only works for the purpose it was made for. A verification link must never
//    work as a password reset.
import crypto from 'node:crypto';
import { q } from '../db.js';

// The purposes the database allows. They are listed here too, so a typo fails in JavaScript
// with a clear message and not as a database error.
export const TOKEN_PURPOSES = ['verify_email', 'reset_password'];

// SHA-256 and not bcrypt. The input is 32 random bytes, not a password a person chose,
// so there is nothing for a slow hash to protect and the lookup stays a fast exact match.
const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

// Makes a token, stores its hash and returns the raw value.
// 24 hours is long enough for someone who registers at night and short enough
// that a link in an abandoned inbox stops working.
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

// Uses a token. Returns its row. Returns null if it is unknown, already used, expired or made
// for a different purpose. The caller learns only "no".
//
// One UPDATE checks and marks the token together. If two people use the same link at the
// same moment, the database lets exactly one of them through.
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

// Why a token was refused. Only for a caller that already holds the token, so the answer
// tells them nothing new. Never use it where the caller gave only an email or an id.
// Returns 'unknown', 'used', 'expired' or 'valid'. Call it after consumeToken returned null.
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

// Invitations for legal experts. The invitation is the only way to get that role.
//
// Only a hash of the token is stored. The raw token exists once, in the email.
// A token works once. If two people use the same link at the same moment the database
// lets exactly one of them through.
import crypto from 'node:crypto';
import { q } from '../db.js';

const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

// Makes an invitation. Older invitations are left working until supersedeOlderInvites is called,
// which happens only after the email was sent. Returns the row and the raw token.
export async function createInvite(email, days, createdBy) {
  const raw = crypto.randomBytes(24).toString('base64url');
  const [invite] = await q(
    `INSERT INTO invite_tokens (token_hash, email, expires_at, created_by)
     VALUES ($1, $2, now() + ($3::int * interval '1 day'), $4)
     RETURNING id, email, expires_at`,
    [hashToken(raw), email, days, createdBy]);
  return { invite, raw };
}

// Cancels the older unused invitations for the address so only the newest link works.
export async function supersedeOlderInvites(email, keepId) {
  await q('UPDATE invite_tokens SET used_at = now() WHERE email = $1 AND used_at IS NULL AND id <> $2', [email, keepId]);
}

// Uses an invitation. Returns its row or null if it is unknown, used or expired.
// Pass a transaction client to use it inside that transaction. A rollback then gives the
// invitation back, so nothing else has to undo it.
export async function consumeInvite(raw, client = null) {
  if (!raw) return null;
  const sql = `UPDATE invite_tokens SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING id, email`;
  const rows = client ? (await client.query(sql, [hashToken(raw)])).rows : await q(sql, [hashToken(raw)]);
  return rows[0] || null;
}

// Why an invitation was refused. Only for a caller that already holds the token.
// Returns 'unknown', 'used', 'expired' or 'valid'.
export async function inviteStatus(raw) {
  if (!raw) return 'unknown';
  const [row] = await q(
    `SELECT used_at IS NOT NULL AS used, expires_at <= now() AS expired
       FROM invite_tokens WHERE token_hash = $1`,
    [hashToken(raw)]);
  if (!row) return 'unknown';
  if (row.used) return 'used';
  if (row.expired) return 'expired';
  return 'valid';
}

// Removes an invitation that was never sent, for example when the email could not be sent.
export async function deleteInvite(id) {
  await q('DELETE FROM invite_tokens WHERE id = $1', [id]);
}

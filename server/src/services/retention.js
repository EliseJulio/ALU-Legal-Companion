// Deletes anonymous records that are kept for too long.
// Only records with no account are touched. Signed-in questions, bookings, reports, matters
// and accounts are never deleted here.
import { q } from '../db.js';

const RETENTION_DAYS = 90;
const TOKEN_DAYS = 30;

// Removes anonymous questions answered more than 90 days ago and anonymous bookings whose slot is
// more than 90 days in the past, whatever their status. A record exactly 90 days old is kept.
// An anonymous question with no answer is kept, however old it is.
// An old answered question has no time of answer, so its creation date is used for it.
// Also removes link tokens (email checks, password resets, invitations) 30 days after they
// expired or were used. Returns counts only.
export async function purgeExpired(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const questions = await q(
    `DELETE FROM questions
      WHERE anon_token IS NOT NULL
        AND (
          (answered_at IS NOT NULL AND answered_at < $1)
          OR (answered_at IS NULL AND status = 'answered' AND created_at < $1)
        )
      RETURNING id`,
    [cutoff],
  );

  const bookings = await q(
    `DELETE FROM bookings
      WHERE anon_token IS NOT NULL
        AND slot < $1
      RETURNING id`,
    [cutoff],
  );

  // One-time link tokens, kept 30 days after they expired or were used. Accounts are not touched.
  const tokenCutoff = new Date(now.getTime() - TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const tokenSql = (table) => q(
    `DELETE FROM ${table}
      WHERE expires_at < $1 OR (used_at IS NOT NULL AND used_at < $1)
      RETURNING id`,
    [tokenCutoff],
  );
  const authTokens = await tokenSql('auth_tokens');
  const inviteTokens = await tokenSql('invite_tokens');

  return {
    questions: questions.length,
    bookings: bookings.length,
    tokens: authTokens.length + inviteTokens.length,
  };
}

-- Sessions that can end, and password reset links.

-- Counts how many times an account's sessions have been ended. A login token carries the
-- number it was made with, and it only works while the number still matches. Adding 1 ends
-- every token made before.
-- A counter is used and not a time. Token times are only whole seconds, which would leave a
-- gap where a new token is refused or an old one still works.
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;

-- auth_tokens can now also carry password reset links.
ALTER TABLE auth_tokens DROP CONSTRAINT auth_tokens_purpose_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_purpose_check
  CHECK (purpose IN ('verify_email', 'reset_password'));

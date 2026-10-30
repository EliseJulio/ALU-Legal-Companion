-- Changing the email address of an account.
-- The new address waits in pending_email until the link sent to it is used. Until then the account
-- keeps its old address. Writing the new address first would let one typo lock a person out for good.
ALTER TABLE users ADD COLUMN pending_email TEXT;

-- A third kind of one-time link, next to verifying an address and resetting a password.
ALTER TABLE auth_tokens DROP CONSTRAINT auth_tokens_purpose_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_purpose_check
  CHECK (purpose IN ('verify_email', 'reset_password', 'change_email'));

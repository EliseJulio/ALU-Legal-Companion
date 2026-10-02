-- Account settings: changing your email address.

-- The address a person has asked to move to but has not confirmed yet.
-- The email column does not change until the new address is confirmed. If it changed first,
-- one typo could lock someone out of their own account.
ALTER TABLE users ADD COLUMN pending_email TEXT;

-- auth_tokens can now also carry the link that confirms a new email address.
ALTER TABLE auth_tokens DROP CONSTRAINT auth_tokens_purpose_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_purpose_check
  CHECK (purpose IN ('verify_email', 'reset_password', 'change_email'));

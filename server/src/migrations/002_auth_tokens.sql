-- One-time links sent by email: verify an address or reset a password.
-- Only a hash of the token is stored. A leaked row cannot be used to take over an account.
CREATE TABLE auth_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_purpose ON auth_tokens (user_id, purpose);

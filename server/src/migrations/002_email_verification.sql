-- Email verification. A new account must prove it owns its email before it can sign in.
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- One-time links that are sent by email.
-- Only a hash of each token is saved. If the database leaks, the rows cannot be used as links.
CREATE TABLE auth_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('verify_email')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_purpose ON auth_tokens (user_id, purpose);

-- Invitations for legal experts. This is the only way to get the legal_expert role.
-- The invitation is emailed to the person. Redeeming it proves they own that address
-- before they gain the power to verify law. So the role is not a field anyone can set.
-- Only a hash of the token is stored. The token itself is in the email and nowhere else.
CREATE TABLE invite_tokens (
  id         SERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  email      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  -- Set when the invitation is redeemed. It is also set when a newer invitation replaces it.
  used_at    TIMESTAMPTZ,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invite_tokens_email_idx ON invite_tokens (email) WHERE used_at IS NULL;

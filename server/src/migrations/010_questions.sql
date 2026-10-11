-- Questions for a legal expert. A person can send one in their own name or anonymously.
CREATE TABLE questions (
  id          SERIAL PRIMARY KEY,
  -- A signed-in question has a user_id. An anonymous question has an anon_token and no identity.
  -- Exactly one of the two is set. The anon_token column holds a SHA-256 hash of the token
  -- and never the token itself.
  user_id     INTEGER REFERENCES users(id),
  anon_token  TEXT,
  text        TEXT NOT NULL,
  answer      TEXT,
  answered_by INTEGER REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((user_id IS NULL) <> (anon_token IS NULL)),
  CHECK ((status = 'answered') = (answer IS NOT NULL AND answered_by IS NOT NULL))
);
-- Partial, because signed-in rows leave anon_token empty and empty values must not collide.
-- A collision would give one person read access to another person's anonymous question.
CREATE UNIQUE INDEX questions_anon_token_key ON questions (anon_token) WHERE anon_token IS NOT NULL;
CREATE INDEX questions_open_idx ON questions (created_at) WHERE status = 'open';
CREATE INDEX questions_user_idx ON questions (user_id, created_at DESC);

-- Questions sent to legal experts. A question is either signed in (user_id) or anonymous
-- (anon_token). An anonymous question stores no name, email or user id, only a random token
-- that is shown once.
CREATE TABLE questions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  anon_token  TEXT,
  text        TEXT NOT NULL,
  answer      TEXT,
  answered_by INTEGER REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR anon_token IS NOT NULL)
);

-- Partial index: signed-in rows leave anon_token empty and empty values must not collide.
-- A repeated token would let one person read another person's anonymous question.
CREATE UNIQUE INDEX questions_anon_token_key ON questions (anon_token) WHERE anon_token IS NOT NULL;

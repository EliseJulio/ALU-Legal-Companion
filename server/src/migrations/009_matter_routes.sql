-- Matter routes: for each kind of legal matter, where it must go first, the law that says so,
-- the steps after that, and the deadline. Routes follow the same steps as guides and directory
-- entries (draft, pending_review, published) and only a legal expert publishes.
CREATE TABLE matter_routes (
  id                 SERIAL PRIMARY KEY,
  matter_type        TEXT NOT NULL UNIQUE,            -- a stable key, for example 'unreturned_deposit'
  title              TEXT NOT NULL,                   -- the situation in the words a person would use
  keywords           TEXT NOT NULL DEFAULT '',        -- other words people use for it
  first_forum_id     INTEGER NOT NULL REFERENCES providers(id),
  legal_basis        TEXT NOT NULL,                   -- the article that sends it there
  exclusions         TEXT,                            -- when this route does NOT apply
  steps              TEXT[] NOT NULL DEFAULT '{}',    -- in order
  deadline_days      INTEGER,
  deadline_runs_from TEXT,                            -- what the days count from, for example "the Abunzi decision"
  deadline_note      TEXT,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published')),
  verified_by        INTEGER REFERENCES users(id),
  verified_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Search column, filled in by the database.
  tsv                tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || keywords)) STORED,
  CHECK (deadline_days IS NULL OR deadline_days > 0),
  -- A number of days needs something to count from, and the other way round.
  CHECK ((deadline_days IS NULL) = (deadline_runs_from IS NULL)),
  CONSTRAINT matter_routes_published_is_verified
    CHECK (status <> 'published' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE INDEX matter_routes_tsv_idx ON matter_routes USING GIN (tsv);

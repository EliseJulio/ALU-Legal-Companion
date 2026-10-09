-- One row for each kind of matter. It says where the matter must go first, the law that says so,
-- the steps that follow and the deadline. A route is a lookup against checked law.
-- It follows the same steps as a guide: draft, then pending_review, then published.
CREATE TABLE matter_routes (
  id                 SERIAL PRIMARY KEY,
  matter_type        TEXT NOT NULL UNIQUE,            -- a stable key such as 'small_civil_claim'
  title              TEXT NOT NULL,                   -- the situation in a reader's own words
  keywords           TEXT NOT NULL DEFAULT '',        -- other words people use for it
  first_forum_id     INTEGER NOT NULL REFERENCES providers(id),
  legal_basis        TEXT NOT NULL,                   -- the article that sends it there
  exclusions         TEXT,                            -- when this route does not apply
  steps              TEXT[] NOT NULL DEFAULT '{}',    -- in order
  deadline_days      INTEGER,
  deadline_runs_from TEXT,                            -- what the days are counted from
  deadline_note      TEXT,
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'pending_review', 'published')),
  verified_by        INTEGER REFERENCES users(id),
  verified_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The column the search reads. Postgres keeps it up to date.
  tsv                tsvector GENERATED ALWAYS AS
                     (to_tsvector('english', title || ' ' || keywords)) STORED,
  CHECK (deadline_days IS NULL OR deadline_days > 0),
  -- A number of days with nothing to count from is not a deadline anyone can use.
  CHECK ((deadline_days IS NULL) = (deadline_runs_from IS NULL)),
  CONSTRAINT matter_routes_published_is_verified
    CHECK (status <> 'published' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE INDEX matter_routes_tsv_idx ON matter_routes USING GIN (tsv);

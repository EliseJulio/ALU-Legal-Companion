-- The decisions a legal expert makes about a guide. Rows are only added, never changed.
-- Every guide goes through review again each time it is edited so one comment column on the
-- guide would lose the reason for the earlier return. A table keeps all of them.
CREATE TABLE guide_reviews (
  id          SERIAL PRIMARY KEY,
  guide_id    INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  decision    TEXT NOT NULL CHECK (decision IN ('returned', 'verified')),
  comment     TEXT,  -- the reason for a return. Empty for a verification.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A guide cannot be returned without saying why.
  CHECK (decision <> 'returned' OR comment IS NOT NULL)
);
CREATE INDEX guide_reviews_guide_idx ON guide_reviews (guide_id, id DESC);

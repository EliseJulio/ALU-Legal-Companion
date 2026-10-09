-- The decisions a legal expert makes about directory entries.
-- Rows are only added. A second return never erases the reason for the first.
-- record_id points at a provider now and at a route later, so it has no foreign key.
CREATE TABLE directory_reviews (
  id          SERIAL PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN ('provider', 'route')),
  record_id   INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  decision    TEXT NOT NULL CHECK (decision IN ('returned', 'verified')),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision <> 'returned' OR comment IS NOT NULL)
);
CREATE INDEX directory_reviews_record_idx ON directory_reviews (record_type, record_id, id DESC);

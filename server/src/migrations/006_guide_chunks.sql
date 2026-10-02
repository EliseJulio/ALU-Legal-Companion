-- Each guide is split into small pieces (chunks).
-- Chunks only exist for published guides. They are created when a legal expert verifies a
-- guide and deleted when it is edited.
CREATE TABLE guide_chunks (
  id         SERIAL PRIMARY KEY,
  guide_id   INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  -- Search column, filled in by the database.
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED
);
CREATE INDEX guide_chunks_tsv_idx ON guide_chunks USING GIN (tsv);

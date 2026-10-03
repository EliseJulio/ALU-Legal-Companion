-- Saved guides for signed-in students and staff.
-- There is no anonymous version. A saved list tied to an anonymous token would be a lasting
-- record of what an anonymous person read.
-- The row is never deleted when a guide is unpublished. The list filters on status so a saved
-- guide comes back by itself once a legal expert verifies it again.
CREATE TABLE bookmarks (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guide_id   INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, guide_id)
);
CREATE INDEX bookmarks_user_idx ON bookmarks (user_id, created_at DESC);

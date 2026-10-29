-- A check of one line of a guide's "how to do it" part. A fee, a document or an office.
-- This table was dropped again in 025. An admin now checks a whole guide.
-- The line is named by a fingerprint of its content and not by its position. When an admin edits
-- the line the check no longer matches. So the line goes back to unchecked by itself.
CREATE TABLE guide_item_checks (
  id         SERIAL PRIMARY KEY,
  guide_id   INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('fee', 'document', 'office')),
  item_hash  TEXT NOT NULL CHECK (item_hash ~ '^[a-f0-9]{64}$'),
  label      TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('confirmed', 'not_correct', 'cannot_confirm')),
  comment    TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  checked_by INTEGER NOT NULL REFERENCES users(id),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guide_id, kind, item_hash)
);

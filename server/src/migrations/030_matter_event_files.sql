-- One optional file on an entry in the record of a matter. A letter from a landlord. A photo.
--
-- The file is encrypted on disk exactly like a matter document. This table only says where it is
-- and how to read it. An attachment never exists without its entry (the cascade) and an entry
-- never changes after it is written, so there is no update or replace for this table.
-- Access is exactly the access to the matter.
CREATE TABLE IF NOT EXISTS matter_event_files (
  id            SERIAL PRIMARY KEY,
  matter_id     INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  event_id      INTEGER NOT NULL UNIQUE REFERENCES matter_events(id) ON DELETE CASCADE,
  -- Random. Never the name the file had on the person's laptop.
  stored_name   TEXT NOT NULL UNIQUE CHECK (stored_name ~ '^[a-f0-9]{32}$'),
  -- Only for showing the person their own file name back. Cleaned before it is stored.
  original_name TEXT NOT NULL CHECK (char_length(original_name) BETWEEN 1 AND 120),
  mime          TEXT NOT NULL CHECK (mime IN ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes    INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256        TEXT NOT NULL,
  iv            TEXT NOT NULL,
  auth_tag      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS matter_event_files_matter_idx ON matter_event_files (matter_id);

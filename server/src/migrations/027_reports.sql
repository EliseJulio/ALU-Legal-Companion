-- Reports of a problem on the site: a wrong fact or a wrong office or something broken or a safety concern or a suggestion.
-- Anyone can send one.
-- There is no user_id and no IP address on purpose.
-- A report never says who sent it unless the sender typed an email address.
CREATE TABLE reports (
  id            SERIAL PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('info', 'office', 'broken', 'safety', 'idea')),
  -- What the sender was looking at. The label is the page title the sender saw.
  about_kind    TEXT CHECK (about_kind IN ('guide', 'route', 'provider', 'page')),
  about_id      INTEGER,
  about_label   TEXT CHECK (char_length(about_label) <= 200),
  message       TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  -- How the sender is answered. 'code' stores a SHA-256 hash of the code and never the code.
  -- 'email' stores the address only until the reply has been sent, then it is set to NULL.
  reply_channel TEXT NOT NULL CHECK (reply_channel IN ('code', 'email')),
  code_hash     TEXT,
  contact_email TEXT,
  status        TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_progress', 'resolved')),
  admin_reply   TEXT CHECK (char_length(admin_reply) <= 1000),
  read_at       TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (reply_channel = 'code' AND code_hash IS NOT NULL AND contact_email IS NULL)
    OR (reply_channel = 'email' AND code_hash IS NULL)
  ),
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL))
);
CREATE UNIQUE INDEX reports_code_hash_key ON reports (code_hash) WHERE code_hash IS NOT NULL;
CREATE INDEX reports_status_idx ON reports (status, created_at DESC);

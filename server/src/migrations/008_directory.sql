-- The directory: the bodies in Rwanda that solve legal problems.
-- Entries follow the same steps as guides: draft, pending_review, then published. Only a legal
-- expert publishes. Editing a checked fact sends the entry back to draft.
CREATE TABLE providers (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN (
    'pro_bono_lawyer', 'maj_office', 'labour_inspector', 'abunzi', 'isange', 'investigation',
    'immigration', 'business_registry', 'legal_aid', 'ombudsman', 'human_rights', 'other')),
  location            TEXT,
  contact             TEXT,
  services            TEXT,
  languages           TEXT,
  is_free             BOOLEAN NOT NULL DEFAULT false,
  official_source_url TEXT,
  -- The day the entry was last checked against the body's own source. A date, not a time.
  last_checked_at     DATE,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published')),
  verified_by         INTEGER REFERENCES users(id),
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A published entry must name the legal expert who verified it.
  CONSTRAINT providers_published_is_verified
    CHECK (status <> 'published' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);

-- The decisions a legal expert makes about directory entries (and, later, routes).
-- Rows are only added, so a second return never erases the reason for the first.
-- record_id points at a provider or a route depending on record_type, so it has no foreign key.
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

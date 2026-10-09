-- The directory: the lawyers, consultants and organisations in Rwanda that solve legal problems.
-- An entry follows the same steps as a guide: draft, then pending_review, then published.
-- Only a legal expert publishes. Editing a checked fact sends the entry back to draft.
CREATE TABLE providers (
  id                  SERIAL PRIMARY KEY,
  -- The login of the legal expert behind this entry. Most entries have none.
  user_id             INTEGER REFERENCES users(id),
  name                TEXT NOT NULL,
  -- The group a person looks in first.
  category            TEXT NOT NULL CHECK (category IN ('lawyer', 'consultant', 'organisation')),
  -- The kind of body.
  type                TEXT NOT NULL CHECK (type IN (
    'pro_bono_lawyer', 'maj_office', 'labour_inspector', 'abunzi', 'isange', 'investigation',
    'immigration', 'business_registry', 'legal_aid', 'ombudsman', 'human_rights', 'other')),
  location            TEXT,
  contact             TEXT,
  services            TEXT,
  languages           TEXT,
  is_free             BOOLEAN NOT NULL DEFAULT false,
  official_source_url TEXT,
  -- The day the entry was last checked against the body's own source. A date and not a time.
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
CREATE INDEX providers_category_idx ON providers (category, status);

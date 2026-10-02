-- Legal guides. Each guide follows the same template.
CREATE TABLE guides (
  id          SERIAL PRIMARY KEY,
  domain      TEXT NOT NULL,   -- tenancy, employment, business, immigration or harassment
  title       TEXT NOT NULL,
  situation   TEXT NOT NULL,
  law_says    TEXT NOT NULL,   -- with article numbers
  your_rights TEXT NOT NULL,
  steps       TEXT NOT NULL,
  get_help    TEXT NOT NULL,
  source_law  TEXT NOT NULL,   -- for example "Law No. 66/2018 of 30/08/2018"
  source_url  TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published')),
  verified_by INTEGER REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A published guide must name the legal expert who verified it.
  CONSTRAINT guides_published_is_verified
    CHECK (status <> 'published' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);

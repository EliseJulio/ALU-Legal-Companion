-- Guides: legal information in simple words. An admin checks and publishes each one.
-- A guide follows the same steps as a directory entry: draft, then pending_review, then published.
-- Only an admin publishes. Any edit to a published guide sends it back to draft.
CREATE TABLE guides (
  id          SERIAL PRIMARY KEY,
  domain      TEXT NOT NULL CHECK (domain IN ('tenancy', 'employment', 'business', 'immigration', 'harassment')),
  title       TEXT NOT NULL,
  -- The fixed template: situation, what the law says, your rights, steps and where to get help.
  situation   TEXT NOT NULL,
  law_says    TEXT NOT NULL,   -- with article citations
  your_rights TEXT NOT NULL,
  steps       TEXT NOT NULL,
  get_help    TEXT NOT NULL,
  source_law  TEXT NOT NULL,   -- for example 'Law No. 66/2018 of 30/08/2018'
  source_url  TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published')),
  verified_by INTEGER REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A published guide must name the admin who published it.
  CONSTRAINT guides_published_is_verified
    CHECK (status <> 'published' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE INDEX guides_status_idx ON guides (status, domain);

-- The publish decisions are kept in directory_reviews for guides too.
ALTER TABLE directory_reviews DROP CONSTRAINT directory_reviews_record_type_check;
ALTER TABLE directory_reviews ADD CONSTRAINT directory_reviews_record_type_check
  CHECK (record_type IN ('provider', 'route', 'guide'));

-- Saved guides for signed-in students and staff. There is no anonymous version. A saved list
-- tied to an anonymous token would be a lasting record of what an anonymous person read.
-- A row is kept when a guide goes back to draft, so the save comes back by itself once the
-- guide is published again.
CREATE TABLE bookmarks (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guide_id   INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, guide_id)
);
CREATE INDEX bookmarks_user_idx ON bookmarks (user_id, created_at DESC);

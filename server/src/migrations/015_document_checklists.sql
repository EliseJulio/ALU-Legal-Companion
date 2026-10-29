-- Document checklists. Which documents a task needs. For example buying a second-hand car.
-- A checklist follows the same steps as a guide. It is a draft, then pending_review, then published.
-- Only an admin publishes. Any edit sends a published checklist back to draft.
-- It is a claim about what an office will ask for. So students only see it once an admin has checked it.
CREATE TABLE document_checklists (
  id             SERIAL PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title          TEXT NOT NULL,
  description    TEXT,
  -- The documents as JSON. They are checked by services/checklists.js. They live on this row so
  -- they follow the same steps with nothing extra to keep in line.
  items          JSONB NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published')),
  review_comment TEXT,
  verified_by    INTEGER REFERENCES users(id),
  verified_at    TIMESTAMPTZ,
  -- Goes up on every edit. It was dropped again in 024, because the admin now publishes directly.
  revision       INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A published checklist must name the admin who published it.
  CONSTRAINT document_checklists_published_is_verified
    CHECK (status <> 'published' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);

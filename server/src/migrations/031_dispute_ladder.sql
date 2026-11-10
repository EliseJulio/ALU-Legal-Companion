-- The steps of the dispute ladder. An admin writes them and publishes each one.
-- A step is shown only when it is published. Editing a published step sends it back to draft,
-- as with a route, a guide or a directory entry.
CREATE TABLE IF NOT EXISTS dispute_ladder_steps (
  id          SERIAL PRIMARY KEY,
  -- The order on screen. Steps with the same number keep the order they were made in.
  position    INTEGER NOT NULL CHECK (position BETWEEN 1 AND 99),
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  tagline     TEXT NOT NULL DEFAULT '' CHECK (char_length(tagline) <= 120),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  law_cited   TEXT NOT NULL DEFAULT '' CHECK (char_length(law_cited) <= 200),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispute_ladder_steps_order_idx
  ON dispute_ladder_steps (status, position, id);

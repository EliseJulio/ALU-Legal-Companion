-- Crisis and referral contacts. An admin can correct a wrong number without a deploy.
-- The column is when_to_use because "when" is a reserved word in SQL.
CREATE TABLE emergency_contacts (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  contact     TEXT NOT NULL,
  when_to_use TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 100,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX emergency_contacts_order ON emergency_contacts (sort_order, id);

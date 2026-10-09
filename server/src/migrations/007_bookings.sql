-- Consultations: a booking with a lawyer or consultant.

-- Only some entries take bookings. A bookable entry needs a legal expert account because the
-- expert finds the requests through it. Without the account the requests would go nowhere
-- and nothing would show an error.
ALTER TABLE providers ADD COLUMN bookable  BOOLEAN NOT NULL DEFAULT false;
-- The video room the expert uses. It is one room for each expert and is used for every
-- consultation. Only an https://meet.google.com/ address is accepted.
ALTER TABLE providers ADD COLUMN meet_link TEXT;
ALTER TABLE providers ADD CONSTRAINT providers_bookable_needs_expert
  CHECK (NOT bookable OR user_id IS NOT NULL);

CREATE TABLE bookings (
  id          SERIAL PRIMARY KEY,
  -- A signed-in booking has a user_id. An anonymous booking has an anon_token and no identity.
  -- Exactly one of the two is set. The anon_token column holds a SHA-256 hash of the token
  -- and never the token itself.
  user_id     INTEGER REFERENCES users(id),
  anon_token  TEXT,
  provider_id INTEGER NOT NULL REFERENCES providers(id),
  slot        TIMESTAMPTZ NOT NULL,
  topic       TEXT,
  status      TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'declined', 'completed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((user_id IS NULL) <> (anon_token IS NULL))
);
-- Partial, because signed-in rows leave anon_token empty and empty values must not collide.
-- A collision would give one person read access to another person's anonymous booking.
CREATE UNIQUE INDEX bookings_anon_token_key ON bookings (anon_token) WHERE anon_token IS NOT NULL;
-- An expert cannot be in two rooms at the same time.
CREATE UNIQUE INDEX bookings_one_accepted_per_slot ON bookings (provider_id, slot) WHERE status = 'accepted';
CREATE INDEX bookings_user_idx ON bookings (user_id, slot DESC);

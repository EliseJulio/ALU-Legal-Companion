-- A matter is a person's own record of a legal problem. It holds what they have done,
-- what comes next and the deadline.
-- It is private. Only the owner can see it. A legal expert sees it only while the owner
-- shares it. There is no anonymous matter because a lasting record and an untraceable one
-- cannot both be true. So user_id is always set.
CREATE TABLE matters (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id    INTEGER REFERENCES matter_routes(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  next_action TEXT,
  next_due    DATE,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  -- The directory entry (a lawyer or office with an expert account) this matter is shared with.
  -- Empty means shared with nobody. Ending the share sets it back to empty. The expert loses
  -- access on the next request because there is no copy on their side.
  shared_with INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  shared_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((shared_with IS NULL) = (shared_at IS NULL))
);
CREATE INDEX matters_user_idx ON matters (user_id, updated_at DESC);

-- What has been done on a matter and when. The owner writes entries. An expert can add notes
-- while the matter is shared. author_id says which, so a note can never pass for the owner's own.
CREATE TABLE matter_events (
  id          SERIAL PRIMARY KEY,
  matter_id   INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES users(id),
  occurred_on DATE NOT NULL,
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX matter_events_matter_idx ON matter_events (matter_id, occurred_on DESC, id DESC);

-- Reminders are advice only. The deadline stays the person's responsibility.
-- Every reminder records what happened to it so delivery can be counted.
--   pending    not yet sent
--   sent       went out on or before due_on
--   missed     the deadline passed before it went out. It is never sent late because a
--              reminder for a deadline that has gone is worse than none.
--   cancelled  the deadline changed or the matter was closed before it went out
CREATE TABLE reminders (
  id         SERIAL PRIMARY KEY,
  matter_id  INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  due_on     DATE NOT NULL,
  send_on    DATE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'missed', 'cancelled')),
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (send_on <= due_on),
  CHECK ((status = 'sent') = (sent_at IS NOT NULL))
);
CREATE INDEX reminders_pending_idx ON reminders (send_on) WHERE status = 'pending';

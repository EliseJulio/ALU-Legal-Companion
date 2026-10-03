-- Matters: a person's own record of a legal problem with a deadline and reminders.
-- A matter always belongs to a signed-in user. There are no anonymous matters.
CREATE TABLE matters (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id    INTEGER REFERENCES matter_routes(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  next_action TEXT,
  next_due    DATE,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX matters_user_idx ON matters (user_id, updated_at DESC);

-- What has been done on a matter and when. author_id says who wrote each line.
CREATE TABLE matter_events (
  id          SERIAL PRIMARY KEY,
  matter_id   INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES users(id),
  occurred_on DATE NOT NULL,
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX matter_events_matter_idx ON matter_events (matter_id, occurred_on DESC, id DESC);

-- Reminders are advice only. Each one ends as sent, missed or cancelled.
--   pending    not sent yet
--   sent       went out on or before the deadline
--   missed     the deadline passed first. It is never sent late and it is counted.
--   cancelled  the deadline changed or the matter closed first
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

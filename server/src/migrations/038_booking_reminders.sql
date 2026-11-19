-- Reminders for a consultation. One row for each person and each time before the slot.
-- Each row ends as sent, missed or cancelled. Deleting a booking deletes its reminders.
CREATE TABLE IF NOT EXISTS booking_reminders (
  id         SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  recipient  TEXT NOT NULL CHECK (recipient IN ('owner', 'lawyer')),
  kind       TEXT NOT NULL CHECK (kind IN ('day', 'hour')),
  send_at    TIMESTAMPTZ NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'missed', 'cancelled')),
  sent_at    TIMESTAMPTZ,
  CHECK ((status = 'sent') = (sent_at IS NOT NULL)),
  UNIQUE (booking_id, recipient, kind)
);
CREATE INDEX IF NOT EXISTS booking_reminders_due_idx ON booking_reminders (status, send_at);

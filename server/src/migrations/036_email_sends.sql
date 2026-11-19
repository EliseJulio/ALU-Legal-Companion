-- How many emails were sent on each Kigali day. The daily email budget reads and counts this table.
-- One row for each day. It holds only a day and a number, never an address.
CREATE TABLE IF NOT EXISTS email_sends (
  day   DATE PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0)
);

-- Consultation hours. A lawyer saves weekly windows for an entry. availability_set_at stays empty
-- until the first save. Until then the standard hours apply in code and are not stored here.
ALTER TABLE providers ADD COLUMN IF NOT EXISTS availability_set_at TIMESTAMPTZ NULL;

-- One row for each window. Times are minutes after midnight in Kigali time and sit on the half hour.
-- Windows on one day must not overlap. The application checks that, because a table cannot.
CREATE TABLE IF NOT EXISTS provider_availability (
  id           SERIAL PRIMARY KEY,
  provider_id  INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  weekday      SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_minute SMALLINT NOT NULL,
  end_minute   SMALLINT NOT NULL,
  CHECK (start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute
         AND start_minute % 30 = 0 AND end_minute % 30 = 0),
  UNIQUE (provider_id, weekday, start_minute)
);
CREATE INDEX IF NOT EXISTS provider_availability_provider_idx ON provider_availability (provider_id);

-- A booking can now be cancelled. The status check is found by its definition, not its name,
-- and replaced with one that lists all five values.
DO $$
DECLARE
  rule RECORD;
BEGIN
  FOR rule IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'bookings'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT %I', rule.conname);
  END LOOP;
  ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('requested', 'accepted', 'declined', 'completed', 'cancelled'));
END $$;

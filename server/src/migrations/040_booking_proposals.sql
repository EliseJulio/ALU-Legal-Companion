-- A lawyer can suggest another time for a waiting request, and a person can move a consultation.
-- A suggestion waits in proposed_slot until the person answers it. It is kept only while the
-- booking is still a request, so every change of status must clear it in the same update.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_slot TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'bookings'::regclass AND conname = 'bookings_proposal_needs_request'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_proposal_needs_request
      CHECK (proposed_slot IS NULL OR status = 'requested');
  END IF;
END $$;

-- A booking can outlive the account of the person who made it. Erasing the account sets user_id
-- to empty and the lawyer keeps the record of the appointment. Such a booking has no user_id and
-- no anon_token, so the rule "exactly one of the two" becomes "not both".
DO $$
DECLARE
  rule TEXT;
BEGIN
  SELECT conname INTO rule
    FROM pg_constraint
   WHERE conrelid = 'bookings'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%user_id IS NULL%anon_token IS NULL%';
  IF rule IS NOT NULL THEN
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT %I', rule);
  END IF;
END $$;

ALTER TABLE bookings ADD CONSTRAINT bookings_one_requester_at_most
  CHECK (user_id IS NULL OR anon_token IS NULL);

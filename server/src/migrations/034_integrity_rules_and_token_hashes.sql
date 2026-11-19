-- Integrity rules for databases made before these checks existed.

-- Part 1: a published row must name the admin who published it.
-- A check is added only where it is missing. If a published row has no verifier, the migration
-- stops and names the table. It does not change that row.
DO $$
DECLARE
  t TEXT;
  cname TEXT;
  unverified INTEGER;
BEGIN
  FOREACH t IN ARRAY ARRAY['guides', 'providers', 'matter_routes', 'document_checklists'] LOOP
    cname := t || '_published_is_verified';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = to_regclass(t) AND conname = cname
    ) THEN
      EXECUTE format(
        'SELECT count(*)::int FROM %I WHERE status = ''published'' AND (verified_by IS NULL OR verified_at IS NULL)',
        t) INTO unverified;
      IF unverified > 0 THEN
        RAISE EXCEPTION '%: % published row(s) have no verifier, so % cannot be added. Nothing was changed.',
          t, unverified, cname;
      END IF;
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (status <> ''published'' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))',
        t, cname);
    END IF;
  END LOOP;
END $$;

-- Part 2: an anonymous code is stored only as its SHA-256 hash, as the application already does.
-- A code kept in plain text cannot be used again: the application accepts only the current format,
-- so the hash is all that is needed. A value that is already 64 lowercase hex characters is left alone.
DO $$
DECLARE
  t TEXT;
  clashes INTEGER;
BEGIN
  FOREACH t IN ARRAY ARRAY['questions', 'bookings'] LOOP
    -- Two rows must never end up with the same value, because the unique index would refuse it.
    -- This checks for that first, so the failure names the table and nothing is changed.
    EXECUTE format($sql$
      WITH plain AS (
        SELECT id, encode(sha256(convert_to(anon_token, 'UTF8')), 'hex') AS h
          FROM %1$I
         WHERE anon_token IS NOT NULL AND anon_token !~ '^[0-9a-f]{64}$'
      )
      SELECT (SELECT count(*) - count(DISTINCT h) FROM plain)
           + (SELECT count(*) FROM plain p
               WHERE EXISTS (SELECT 1 FROM %1$I x WHERE x.anon_token = p.h))
      $sql$, t) INTO clashes;
    IF clashes > 0 THEN
      RAISE EXCEPTION '%: % hashed anonymous code(s) would collide. Nothing was changed.', t, clashes;
    END IF;
  END LOOP;
END $$;

UPDATE questions
   SET anon_token = encode(sha256(convert_to(anon_token, 'UTF8')), 'hex')
 WHERE anon_token IS NOT NULL AND anon_token !~ '^[0-9a-f]{64}$';

UPDATE bookings
   SET anon_token = encode(sha256(convert_to(anon_token, 'UTF8')), 'hex')
 WHERE anon_token IS NOT NULL AND anon_token !~ '^[0-9a-f]{64}$';

-- Last check: no readable code is left in either table.
DO $$
DECLARE
  left_over INTEGER;
BEGIN
  SELECT (SELECT count(*) FROM questions WHERE anon_token IS NOT NULL AND anon_token !~ '^[0-9a-f]{64}$')
       + (SELECT count(*) FROM bookings WHERE anon_token IS NOT NULL AND anon_token !~ '^[0-9a-f]{64}$')
    INTO left_over;
  IF left_over > 0 THEN
    RAISE EXCEPTION '% anonymous code(s) are still not hashed', left_over;
  END IF;
END $$;

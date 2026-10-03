-- Sharing a matter with a legal expert.
-- A directory entry can be linked to a legal expert's login. Entries with no login (such as an
-- office) cannot receive a shared matter because nobody would be there to read it.
ALTER TABLE providers ADD COLUMN user_id INTEGER REFERENCES users(id);

-- The entry a matter is shared with now. NULL means it is shared with nobody. Stopping a share
-- sets it back to NULL which ends the expert's access on their next request.
ALTER TABLE matters ADD COLUMN shared_with INTEGER REFERENCES providers(id) ON DELETE SET NULL;
ALTER TABLE matters ADD COLUMN shared_at TIMESTAMPTZ;
ALTER TABLE matters ADD CONSTRAINT matters_shared_pair
  CHECK ((shared_with IS NULL) = (shared_at IS NULL));

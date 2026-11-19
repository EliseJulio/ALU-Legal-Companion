-- The encrypted bytes of a file now live in the row, so they survive a restart or a new deploy.
-- The column stays empty for a row written before this change. Such a file was on the server's disk
-- and cannot be moved from SQL, so reading it answers "Could not read that document".
ALTER TABLE matter_documents ADD COLUMN IF NOT EXISTS content BYTEA;
ALTER TABLE matter_event_files ADD COLUMN IF NOT EXISTS content BYTEA;

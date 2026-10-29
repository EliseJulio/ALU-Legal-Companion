-- This was dropped again in 024. The admin now publishes directly, so nothing needs the lock.
-- The revision lock that document_checklists already had (see 015_document_checklists.sql),
-- extended to guides, providers and routes. Without it an admin could edit a record between the
-- expert opening it for review and pressing Verify, and the expert's stamp would land on text they
-- never read. Goes up whenever an edit sends the record back to draft; verify names the revision
-- the expert read and is refused if it has moved on since.
ALTER TABLE guides ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE providers ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE matter_routes ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

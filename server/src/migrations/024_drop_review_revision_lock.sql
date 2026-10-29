-- The revision lock (020) and last-editor tracking (022) existed to guard a second-person
-- verification race: an admin editing a record between the expert opening it and pressing
-- Verify, or a lawyer verifying their own edit. The supervisor redesign removed the second
-- person entirely (the admin publishes directly), so there is no race left to guard against.
-- Nothing reads either column any more.
ALTER TABLE guides DROP COLUMN revision;
ALTER TABLE guides DROP COLUMN last_edited_by;
ALTER TABLE providers DROP COLUMN revision;
ALTER TABLE matter_routes DROP COLUMN revision;
ALTER TABLE document_checklists DROP COLUMN revision;

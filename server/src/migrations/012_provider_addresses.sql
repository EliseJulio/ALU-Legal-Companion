-- The head office of each body. Where it is. When it is open. What could not be confirmed.
-- These are checked facts like the others. Editing one on a published entry sends it back to draft.
ALTER TABLE providers ADD COLUMN address      TEXT;
ALTER TABLE providers ADD COLUMN hours        TEXT;
ALTER TABLE providers ADD COLUMN address_note TEXT;

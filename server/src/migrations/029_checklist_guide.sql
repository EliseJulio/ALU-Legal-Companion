-- The guide a checklist was borrowed from. It lets a checklist say "based on this guide".
-- Nullable. A checklist written by hand has none. Deleting a guide only clears the link, so a
-- guide can never delete a checklist (and a checklist can never delete a matter).
ALTER TABLE document_checklists ADD COLUMN guide_id INTEGER REFERENCES guides(id) ON DELETE SET NULL;

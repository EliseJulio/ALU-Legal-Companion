-- This was dropped again in 024. A legal expert no longer edits or verifies guides.
-- Closes a self-approval gap a security review found in Slice 6: since a legal expert can now
-- edit a guide (not just admin), the same lawyer could draft a correction and then verify their
-- own edit, with no second person ever checking it. This records who last edited a guide so the
-- verify step can refuse when the verifier is that same person.
ALTER TABLE guides ADD COLUMN last_edited_by INTEGER REFERENCES users(id);

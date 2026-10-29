-- One or two short sentences that say what a guide is for. It shows on the guide card. It is part
-- of the guide, so the integrity rule covers it: any edit sends the guide back to draft and only an
-- admin publishes it again. A guide that already exists has none until an admin writes one.
ALTER TABLE guides ADD COLUMN summary TEXT CHECK (summary IS NULL OR char_length(summary) <= 280);

-- Documents a person attaches to a matter. A passport. A sale agreement. A TIN certificate.
-- The things a lawyer checks before an application goes in.
--
-- The file itself is encrypted on disk. This table only says where it is and how to read it.
-- Access is exactly the access to the matter. The owner and the legal expert it is shared with.

-- A matter can follow a published checklist. Then it shows which documents are still missing.
-- If a checklist is ever deleted the matter stays. It only stops following it.
ALTER TABLE matters ADD COLUMN checklist_id INTEGER REFERENCES document_checklists(id) ON DELETE SET NULL;

CREATE TABLE matter_documents (
  id            SERIAL PRIMARY KEY,
  matter_id     INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  label         TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  -- Which checklist item this file answers. Empty means a file attached freely. It is a key and not
  -- a foreign key. The item lives in the JSON of the checklist and a file must outlive an edit to it.
  item_key      TEXT,
  -- Random. Never the label and never the name the file had on the person's laptop.
  stored_name   TEXT NOT NULL UNIQUE CHECK (stored_name ~ '^[a-f0-9]{32}$'),
  mime          TEXT NOT NULL CHECK (mime IN ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes    INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256        TEXT NOT NULL,
  iv            TEXT NOT NULL,
  auth_tag      TEXT NOT NULL,
  -- What the lawyer said about this exact file. A verdict is on one file. A replacement file is a
  -- new row. So a verdict can never follow different bytes.
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'complete', 'needs_fix', 'out_of_date')),
  review_note   TEXT,
  reviewed_by   INTEGER REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A verdict has a reviewer and a time. Pending has neither.
  CONSTRAINT matter_documents_review_is_attributed
    CHECK ((review_status = 'pending') = (reviewed_by IS NULL AND reviewed_at IS NULL))
);
CREATE INDEX matter_documents_matter_idx ON matter_documents (matter_id, id);

-- One file for each checklist item. A second file for the same item is a replacement. A replacement
-- swaps the row in one transaction. This index makes two files for one item impossible even when
-- two requests arrive at the same moment.
CREATE UNIQUE INDEX matter_documents_one_per_item
  ON matter_documents (matter_id, item_key) WHERE item_key IS NOT NULL;

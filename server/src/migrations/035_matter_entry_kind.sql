-- Tells an entry the person wrote from a line the system or a lawyer wrote.
--
--   entry   written by the owner as part of their record. The owner may delete it.
--   system  written by the application: a share, a stopped share, a checked document, a comment.
--           The lawyer's notes are also system lines for this purpose. They are never deleted by the owner.
--
-- New rows default to 'entry'. The application sets 'system' on each line it writes itself.
ALTER TABLE matter_events
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'entry' CHECK (kind IN ('entry', 'system'));

-- Existing rows. A line the application wrote is recognised by its wording. Any line whose author
-- is not the matter owner is marked system, which covers every lawyer note and lawyer action.
UPDATE matter_events e
   SET kind = 'system'
  FROM matters m
 WHERE m.id = e.matter_id
   AND e.kind = 'entry'
   AND (
        e.author_id <> m.user_id
     OR e.description LIKE 'Shared with %'
     OR e.description LIKE 'Stopped sharing with %'
     OR e.description LIKE 'Sharing with %'
     OR e.description LIKE 'Checked “%'
     OR e.description LIKE 'Commented on “%'
   );

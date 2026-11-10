-- The video room of a consultation. It is made the first time someone joins an accepted booking,
-- and then reused. The name is random and unguessable. The check accepts only the 32 hex
-- characters the service writes, so a bad value cannot be stored.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_name TEXT NULL
  CHECK (room_name IS NULL OR room_name ~ '^[0-9a-f]{32}$');
-- When the room was made. The daily cap counts the rooms made today by this column.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_created_at TIMESTAMPTZ NULL;

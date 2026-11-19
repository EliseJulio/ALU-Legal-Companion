-- Lookups that had no index. The expert inbox and the slot check filter bookings by provider,
-- then status and slot. Deleting a checklist or a directory entry looks for the matters and routes that use it.
CREATE INDEX IF NOT EXISTS bookings_provider_status_slot_idx ON bookings (provider_id, status, slot);
CREATE INDEX IF NOT EXISTS matters_checklist_idx ON matters (checklist_id) WHERE checklist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS matter_routes_first_forum_idx ON matter_routes (first_forum_id);

-- Indexes for lookups that run on every request but had none.
-- The matters a legal expert can see are found by the entry they are shared with.
CREATE INDEX IF NOT EXISTS matters_shared_with_idx ON matters (shared_with) WHERE shared_with IS NOT NULL;
-- The directory entry linked to a lawyer's account is found by that account.
CREATE INDEX IF NOT EXISTS providers_user_idx ON providers (user_id) WHERE user_id IS NOT NULL;
-- The reminders of one matter are found by the matter, for example when it is closed or deleted.
CREATE INDEX IF NOT EXISTS reminders_matter_idx ON reminders (matter_id);

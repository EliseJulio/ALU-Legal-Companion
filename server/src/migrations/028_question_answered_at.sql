-- When a question was answered. It lets the lawyer's overview show how long answers take.
-- It is set by the answer route from now on. Answers given before this have no time and stay NULL.
-- No time is invented for them, so they are left out of the average wait.
ALTER TABLE questions ADD COLUMN answered_at TIMESTAMPTZ;

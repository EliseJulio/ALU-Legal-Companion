-- Legal experts no longer verify or publish anything (supervisor decision) — only consultations
-- and matter-document review remain theirs. The admin now publishes a guide, a directory entry
-- or a route directly, in one step, with no second-person review. 'published' records that as
-- its own decision in directory_reviews, distinct from the old lawyer 'verified' meaning.
ALTER TABLE directory_reviews DROP CONSTRAINT directory_reviews_decision_check;
ALTER TABLE directory_reviews ADD CONSTRAINT directory_reviews_decision_check
  CHECK (decision IN ('returned', 'verified', 'withdrawn', 'published'));

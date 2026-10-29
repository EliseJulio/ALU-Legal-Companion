-- Closes LEG-001 from docs/production-audit-2026-10-27.md: an admin can now withdraw a
-- published guide, not just return one. 'withdrawn' is a new, permanent-until-rewritten
-- state, distinct from 'draft' (which still means "being re-checked, will likely come back").
ALTER TABLE guides DROP CONSTRAINT guides_status_check;
ALTER TABLE guides ADD CONSTRAINT guides_status_check
  CHECK (status IN ('draft', 'pending_review', 'published', 'withdrawn'));

-- The reason a guide was withdrawn is recorded the same way a return comment already is.
ALTER TABLE directory_reviews DROP CONSTRAINT directory_reviews_decision_check;
ALTER TABLE directory_reviews ADD CONSTRAINT directory_reviews_decision_check
  CHECK (decision IN ('returned', 'verified', 'withdrawn'));

ALTER TABLE directory_reviews DROP CONSTRAINT directory_reviews_check;
ALTER TABLE directory_reviews ADD CONSTRAINT directory_reviews_check
  CHECK (decision NOT IN ('returned', 'withdrawn') OR comment IS NOT NULL);

// Records a publish/withdraw decision against a guide, provider or route. Shared so the three
// kinds of record cannot drift apart on how a decision is logged.
import { q } from '../db.js';

export async function recordReview(type, id, reviewerId, decision, comment = null) {
  await q(
    `INSERT INTO directory_reviews (record_type, record_id, reviewer_id, decision, comment)
     VALUES ($1,$2,$3,$4,$5)`,
    [type, id, reviewerId, decision, comment],
  );
}

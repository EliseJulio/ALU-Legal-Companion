// Routing: from the words a person types to the kind of matter and so to the body that must
// hear it first. No language model is used. The match is a database text search over each
// route's title and keywords and the answer is a row that a legal expert verified.
import { q } from '../db.js';

// Finds the matters that match what the person typed, best match first.
// With no text, it returns every matter.
export async function searchRoutes(text = '') {
  const t = typeof text === 'string' ? text.trim().slice(0, 300) : '';
  const params = [];
  let rank = '0';
  let filter = '';
  if (t) {
    params.push(t);
    // The words are joined with OR not AND. People describe a situation in a sentence and
    // asking for every word to match would find nothing for most descriptions. Small words
    // like "my" and "the" are dropped so "my landlord kept the deposit" searches for
    // landlord, kept and deposit.
    const tsq = `to_tsquery('english', array_to_string(
                   ARRAY(SELECT lexeme FROM unnest(to_tsvector('english', $1))), ' | '))`;
    rank = `ts_rank(r.tsv, ${tsq}, 1)`;
    filter = `AND r.tsv @@ ${tsq}`;
  }
  // A route is listed only when the route AND the body it sends people to are both published.
  // A checked route that points at an unchecked office would still send someone to a place
  // nobody has verified.
  return q(
    `SELECT r.id, r.matter_type, r.title, r.deadline_days, r.deadline_runs_from,
            p.id AS first_forum_id, p.name AS first_forum_name, p.type AS first_forum_type,
            ${rank} AS score
       FROM matter_routes r
       JOIN providers p ON p.id = r.first_forum_id AND p.status = 'published'
      WHERE r.status = 'published' ${filter}
      ORDER BY score DESC, r.title`,
    params,
  );
}

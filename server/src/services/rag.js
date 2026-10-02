// The guide text the assistant reads (retrieval-augmented generation).
//
// The assistant may only use chunks of published guides. This file builds and removes those
// chunks. When a legal expert verifies a guide, its chunks are created. When an admin edits
// it, they are deleted. So the assistant can never read text that is unverified or out of date.
import { q } from '../db.js';

// Splits a guide into chunks, one for each section of the template. Small chunks make
// the citations precise. Every chunk carries the title and the law it comes from.
export function chunkGuide(guide) {
  const sections = [
    ['Your situation', guide.situation],
    ['What the law says', guide.law_says],
    ['Your rights', guide.your_rights],
    ['Steps to take', guide.steps],
    ['Where to get help', guide.get_help],
  ];
  return sections
    .filter(([, text]) => text && text.trim())
    .map(([label, text]) => `${guide.title} — ${label}: ${text.trim()} (Source: ${guide.source_law})`);
}

// Saves the chunks of a guide. Called when a legal expert verifies it.
// Any old chunks are removed first so verifying twice does not make duplicates.
export async function indexGuide(guide) {
  await q('DELETE FROM guide_chunks WHERE guide_id = $1', [guide.id]);
  for (const chunk of chunkGuide(guide)) {
    await q('INSERT INTO guide_chunks (guide_id, chunk_text) VALUES ($1, $2)', [guide.id, chunk]);
  }
}

// Deletes the chunks of a guide. Called when an admin edits it.
export async function deindexGuide(guideId) {
  await q('DELETE FROM guide_chunks WHERE guide_id = $1', [guideId]);
}

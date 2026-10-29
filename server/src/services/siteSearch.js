// One search over the three public libraries: guides, matters (routes) and the directory.
// It finds only what an admin has published. A draft, a pending item or a route that
// points at an unchecked office never appears, so the search cannot show unverified content.
// It is a plain text match. No model is asked and the words typed are never stored.
import { q } from '../db.js';
import { searchRoutes } from './routing.js';

export const LIBRARIES = ['guides', 'routes', 'providers'];
export const MAX_RESULTS = 6;
export const MIN_QUERY = 2;
export const MAX_QUERY = 100;
const MAX_WORDS = 6;

// A percent or an underscore typed by a reader is a character and not a wildcard. The escape
// character is "!" and not a backslash, so the query reads the same whatever the database does
// with backslashes in a string.
const likeEscape = (word) => word.replace(/[!%_]/g, (c) => `!${c}`);

// The words of the query. Every word must be found, so a longer question narrows the answer.
export function wordsOf(text) {
  return text.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
}

// WHERE parts that need every word in the given text expression. $1 and up are the words.
function everyWord(expression, words) {
  return words.map((_, i) => `${expression} ILIKE $${i + 1} ESCAPE '!'`).join(' AND ');
}
const patterns = (words) => words.map((w) => `%${likeEscape(w)}%`);

async function findGuides(words) {
  return q(
    `SELECT id, title, summary, domain, source_law
       FROM guides
      WHERE status = 'published'
        AND ${everyWord("(title || ' ' || COALESCE(summary, '') || ' ' || source_law)", words)}
      ORDER BY title
      LIMIT ${MAX_RESULTS}`,
    patterns(words),
  );
}

async function findProviders(words) {
  return q(
    `SELECT id, name, type, location, services
       FROM providers
      WHERE status = 'published'
        AND ${everyWord("(name || ' ' || COALESCE(services, '') || ' ' || COALESCE(location, '') || ' ' || COALESCE(languages, ''))", words)}
      ORDER BY name
      LIMIT ${MAX_RESULTS}`,
    patterns(words),
  );
}

// The route search already keeps to published routes with a published first office.
async function findRoutes(text) {
  const rows = await searchRoutes(text);
  return rows.slice(0, MAX_RESULTS).map((r) => ({ id: r.id, title: r.title, first_forum_name: r.first_forum_name }));
}

// `libraries` is a list taken from LIBRARIES. The answer holds one list for each.
export async function siteSearch(text, libraries) {
  const words = wordsOf(text);
  const finders = {
    guides: () => findGuides(words),
    routes: () => findRoutes(text),
    providers: () => findProviders(words),
  };
  const entries = await Promise.all(libraries.map(async (name) => [name, await finders[name]()]));
  return Object.fromEntries(entries);
}

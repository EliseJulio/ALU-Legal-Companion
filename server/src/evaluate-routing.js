// Routing evaluation (FR-13).  Usage:  npm run evaluate:routing
//
// Puts each situation in docs1/routing-test-set.json through the same search a reader uses
// (services/routing.js), takes the first body the platform names, and compares it with the body
// recorded for that situation in advance. It reads the database and writes nothing.
//
// A situation that no published route covers (expected_first_body is null) is not scored as right
// or wrong. The script lists what the platform named for it, so a body with no power over the
// matter can be seen.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './db.js';
import { searchRoutes } from './services/routing.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SET_PATH = join(HERE, '..', '..', 'docs1', 'routing-test-set.json');
const set = JSON.parse(readFileSync(SET_PATH, 'utf8'));
const situations = set.situations ?? [];

const covered = [];
const gaps = [];
for (const s of situations) {
  const results = await searchRoutes(s.text);
  const named = results[0]?.first_forum_name ?? null;
  const top3 = results.slice(0, 3).map((r) => r.first_forum_name);
  if (s.expected_first_body) {
    const outcome = named === null ? 'no_answer' : named === s.expected_first_body ? 'correct' : 'wrong';
    covered.push({ ...s, named, top3, outcome, inTop3: top3.includes(s.expected_first_body) });
  } else {
    gaps.push({ ...s, named, top3 });
  }
}

const right = covered.filter((c) => c.outcome === 'correct').length;
const wrong = covered.filter((c) => c.outcome === 'wrong').length;
const none = covered.filter((c) => c.outcome === 'no_answer').length;
const top3 = covered.filter((c) => c.inTop3).length;
const pct = covered.length ? Math.round((right / covered.length) * 1000) / 10 : 0;

console.log('');
console.log('Routing evaluation: ' + set.instrument);
console.log('='.repeat(66));
console.log(`  situations in the set                      ${situations.length}`);
console.log(`  covered by a published route               ${covered.length}`);
console.log(`  not covered by any route (coverage gaps)   ${gaps.length}`);
console.log('');
console.log(`  covered situations sent to the right body  ${right} of ${covered.length}`);
console.log(`  sent to another body                       ${wrong}`);
console.log(`  nothing matched                            ${none}`);
console.log(`  right body among the first three results   ${top3} of ${covered.length}`);
console.log(`  ROUTING ACCURACY on covered situations     ${pct}%   (target: at least 90%)`);
console.log('');
console.log('Each covered situation');
for (const c of covered) {
  const mark = c.outcome === 'correct' ? 'right ' : c.outcome === 'wrong' ? 'WRONG ' : 'NONE  ';
  console.log(`  #${String(c.id).padStart(2)} ${mark} "${c.text}"`);
  if (c.outcome !== 'correct') {
    console.log(`        expected: ${c.expected_first_body}`);
    console.log(`        platform: ${c.named ?? '(nothing matched)'}`);
  }
}
if (gaps.length) {
  console.log('');
  console.log('Situations no route covers: what the platform named');
  for (const g of gaps) {
    console.log(`  #${String(g.id).padStart(2)} "${g.text}"`);
    console.log(`        platform: ${g.named ?? '(nothing matched, which is the right answer when no route covers it)'}`);
  }
}
console.log('');
console.log('Limits: ' + (set.limits ?? []).join(' '));
console.log('');
await pool.end();

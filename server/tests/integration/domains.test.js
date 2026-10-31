import { q } from '../../src/db.js';
import { DOMAINS, normalizeDomain } from '../../src/services/domains.js';
import { DOMAINS as FROM_GUIDES } from '../../src/routes/guides.js';

// The list of areas of law is kept in the code and in two database rules. Adding an area to the code
// alone would pass the checks in the API and then fail in the database with a 500. Adding it to a
// rule alone would let a row in that the API refuses. These tests fail when the three disagree.

// The values written in a CHECK rule on one column, read back from the database.
async function allowedValues(table, column) {
  const rows = await q(
    `SELECT pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
      WHERE conrelid = $1::regclass AND contype = 'c'`,
    [table],
  );
  const rule = rows.map((r) => r.definition).find((d) => d.includes(`${column} = ANY`) || d.includes(`${column} IN`));
  if (!rule) throw new Error(`no CHECK rule on ${table}.${column}`);
  return [...rule.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]).sort();
}

describe('the areas of law', () => {
  it('are the same in the code, in the guides rule and in the routes rule', async () => {
    const expected = [...DOMAINS].sort();
    expect(await allowedValues('guides', 'domain')).toEqual(expected);
    expect(await allowedValues('matter_routes', 'area')).toEqual(expected);
  });

  it('are still exported from the guides file for the code that imports them there', () => {
    expect(FROM_GUIDES).toBe(DOMAINS);
  });

  it('are six, each in lower case without spaces', () => {
    expect(DOMAINS).toHaveLength(6);
    for (const area of DOMAINS) expect(area).toBe(area.trim().toLowerCase());
  });
});

describe('normalizeDomain', () => {
  it('ignores capitals and spaces', () => {
    expect(normalizeDomain('  Tenancy ')).toBe('tenancy');
  });

  it('turns anything that is not text into an empty string', () => {
    for (const value of [undefined, null, 5, {}, ['tenancy']]) expect(normalizeDomain(value)).toBe('');
  });
});

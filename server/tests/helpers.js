import bcrypt from 'bcryptjs';
import { q } from '../src/db.js';
import { signToken } from '../src/middleware/auth.js';

// Empties every table the migrations made. The list of applied migrations stays.
// RESTART IDENTITY keeps ids predictable in each test.
export async function resetDb() {
  const tables = await q(
    `SELECT quote_ident(tablename) AS name FROM pg_tables
      WHERE schemaname = current_schema() AND tablename <> 'schema_migrations'`);
  if (tables.length) {
    await q(`TRUNCATE ${tables.map((t) => t.name).join(', ')} RESTART IDENTITY CASCADE`);
  }
}

// email_verified_at is set because a signed-in user is always verified. Login is blocked
// until then, so a fixture without it would be in a state no real account can be in.
export async function makeUser(role, email) {
  const hash = await bcrypt.hash('password1234', 4); // low cost: tests, not production
  const [user] = await q(
    `INSERT INTO users (name, email, password_hash, role, email_verified_at)
     VALUES ($1,$2,$3,$4,now()) RETURNING *`,
    [`Test ${role}`, email || `${role}@alustudent.com`, hash, role],
  );
  const token = signToken(user);
  return { user, token, auth: `Bearer ${token}` };
}

// A complete, valid guide body with every field of the template.
export function guideBody(overrides = {}) {
  return {
    domain: 'employment', title: 'Internship contracts',
    situation: 'You started an internship and have not been paid.',
    law_says: 'Article 8 of Law No. 66/2018 requires a written employment contract.',
    your_rights: 'You are entitled to the terms written in your contract.',
    steps: 'Ask HR in writing and then contact the labour inspector.',
    get_help: 'District labour inspector.',
    source_law: 'Law No. 66/2018 of 30/08/2018',
    source_url: 'https://www.amategeko.gov.rw/',
    ...overrides,
  };
}

// A guide in the database. Pass `verifiedBy` (a user id) to make it published at once.
export async function makeGuide(overrides = {}, { verifiedBy } = {}) {
  const g = guideBody(overrides);
  const [guide] = await q(
    `INSERT INTO guides (domain, title, situation, law_says, your_rights, steps, get_help, source_law,
                         source_url, status, verified_by, verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             CASE WHEN $11::int IS NULL THEN NULL ELSE now() END)
     RETURNING *`,
    [g.domain, g.title, g.situation, g.law_says, g.your_rights, g.steps, g.get_help, g.source_law,
     g.source_url, verifiedBy ? 'published' : 'draft', verifiedBy || null]);
  return guide;
}

// A matter for `userId`.
export async function makeMatter(userId, overrides = {}) {
  const row = { title: 'My landlord kept my deposit', next_action: null, next_due: null, status: 'open', ...overrides };
  const [m] = await q(
    `INSERT INTO matters (user_id, route_id, title, next_action, next_due, status)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId, row.route_id ?? null, row.title, row.next_action, row.next_due, row.status]);
  return m;
}

// A route to `forumId`. Pass `verifiedBy` (a user id) to make it published at once.
export async function makeRoute(forumId, overrides = {}, { verifiedBy } = {}) {
  const row = {
    matter_type: 'unreturned_deposit', title: 'My landlord will not return my deposit',
    keywords: 'rent deposit landlord tenancy house money back', legal_basis: 'Law No. 37/2016, Art. 10',
    exclusions: null, steps: ['Go to the Abunzi committee of your cell', 'Appeal to the sector committee'],
    deadline_days: 30, deadline_runs_from: 'the sector committee decision', deadline_note: null,
    area: null,
    ...overrides,
  };
  const [r] = await q(
    `INSERT INTO matter_routes (matter_type, title, keywords, first_forum_id, legal_basis, exclusions, steps,
                                deadline_days, deadline_runs_from, deadline_note, status, verified_by, verified_at, area)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
             CASE WHEN $12::int IS NULL THEN NULL ELSE now() END, $13)
     RETURNING *`,
    [row.matter_type, row.title, row.keywords, forumId, row.legal_basis, row.exclusions, row.steps,
     row.deadline_days, row.deadline_runs_from, row.deadline_note,
     verifiedBy ? 'published' : 'draft', verifiedBy || null, row.area],
  );
  return r;
}

// A directory entry. Pass `verifiedBy` (a user id) to make it published at once.
// The table refuses a published row with no verifier so a fixture cannot skip that step.
export async function makeProvider(overrides = {}, { verifiedBy } = {}) {
  const row = {
    name: 'Test Legal Aid Office', category: 'consultant', type: 'legal_aid', location: 'Kigali',
    contact: '0788000000', services: 'Free legal advice', languages: 'Kinyarwanda, English',
    is_free: true, user_id: null, ...overrides,
  };
  const [p] = await q(
    `INSERT INTO providers (name, category, type, location, contact, services, languages, is_free,
                            user_id, status, verified_by, verified_at, last_checked_at,
                            bookable, meet_link)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             CASE WHEN $11::int IS NULL THEN NULL ELSE now() END,
             CASE WHEN $11::int IS NULL THEN NULL ELSE CURRENT_DATE END,
             $12, $13)
     RETURNING *`,
    [row.name, row.category, row.type, row.location, row.contact, row.services, row.languages,
     row.is_free, row.user_id, verifiedBy ? 'published' : 'draft', verifiedBy || null,
     row.bookable === true, row.meet_link ?? null],
  );
  return p;
}

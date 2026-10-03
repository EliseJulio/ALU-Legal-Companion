import bcrypt from 'bcryptjs';
import { q } from '../src/db.js';
import { signToken } from '../src/middleware/auth.js';

// Empties the tables. When more tables are added, list the child tables first.
export async function resetDb() {
  await q('TRUNCATE matter_routes, directory_reviews, providers, guide_reviews, guide_chunks, guides, auth_tokens, users RESTART IDENTITY CASCADE');
}

// Makes a verified user and a token that is ready to use. A low bcrypt cost keeps the tests
// fast. The user is verified because a signed-in user always is: login needs it.
export async function makeUser(role, email) {
  const hash = await bcrypt.hash('password1234', 4);
  const [user] = await q(
    `INSERT INTO users (name, email, password_hash, role, email_verified_at)
     VALUES ($1,$2,$3,$4,now()) RETURNING *`,
    [`Test ${role}`, email || `${role}@alustudent.com`, hash, role],
  );
  const token = signToken(user);
  return { user, token, auth: `Bearer ${token}` };
}

// How many chunks a guide has.
export const countChunks = async (guideId) =>
  Number((await q('SELECT count(*)::int AS n FROM guide_chunks WHERE guide_id = $1', [guideId]))[0].n);

// A directory entry. Pass { verifiedBy: userId } to make it already published. The database
// refuses a published entry with no verifier, so a test cannot skip that step.
export async function makeProvider(overrides = {}, { verifiedBy } = {}) {
  const row = {
    name: 'MAJ Gasabo', type: 'maj_office', location: 'Gasabo', contact: '0788000000',
    services: 'Free legal advice', languages: 'Kinyarwanda, English', is_free: true,
    ...overrides,
  };
  const [p] = await q(
    `INSERT INTO providers (name, type, location, contact, services, languages, is_free,
                            status, verified_by, verified_at, last_checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [row.name, row.type, row.location, row.contact, row.services, row.languages, row.is_free,
     verifiedBy ? 'published' : 'draft', verifiedBy || null, verifiedBy ? new Date() : null,
     verifiedBy ? new Date() : null],
  );
  return p;
}

// A complete, valid route that points at the directory entry `forumId`.
export function routeBody(forumId, overrides = {}) {
  return {
    matter_type: 'unreturned_deposit',
    title: 'My landlord will not return my deposit',
    keywords: 'rent deposit landlord tenancy house money back',
    first_forum_id: forumId,
    legal_basis: 'Law No. 37/2016, Art. 10',
    exclusions: 'Not if the landlord is a company or the State (Art. 11).',
    steps: ['Go to the Abunzi committee of your cell', 'Appeal to the sector committee if unhappy'],
    deadline_days: 30,
    deadline_runs_from: 'the sector committee decision',
    ...overrides,
  };
}

// A complete, valid guide with every template field the API needs.
export function guideBody(overrides = {}) {
  return {
    domain: 'employment',
    title: 'Internship contracts',
    situation: 'You started an internship and have not been paid.',
    law_says: 'Article 8 of Law No. 66/2018 requires a written employment contract.',
    your_rights: 'You are entitled to the terms written in your contract.',
    steps: 'Ask HR in writing, then contact the labour inspector.',
    get_help: 'District Labour Inspector (MIFOTRA).',
    source_law: 'Law No. 66/2018 of 30/08/2018',
    source_url: 'https://www.amategeko.gov.rw/',
    ...overrides,
  };
}

import bcrypt from 'bcryptjs';
import { q } from '../src/db.js';
import { signToken } from '../src/middleware/auth.js';

// Empties the tables. When more tables are added, list the child tables first.
export async function resetDb() {
  await q('TRUNCATE guide_reviews, guide_chunks, guides, auth_tokens, users RESTART IDENTITY CASCADE');
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

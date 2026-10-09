// Demo accounts for development. Usage: npm run seed
// Safe to run again. An account that already exists is left as it is.
import { q, pool } from './db.js';
import { hashPassword } from './passwords.js';
import { BUILT_IN_CONTACTS } from './routes/contacts.js';

// These accounts are created already verified. Login is blocked until an address is verified
// and there is no inbox behind these demo addresses.
async function upsertUser(name, email, password, role) {
  const [existing] = await q('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) return existing;
  const [user] = await q(
    `INSERT INTO users (name, email, password_hash, role, email_verified_at)
     VALUES ($1,$2,$3,$4,now()) RETURNING id`,
    [name, email, await hashPassword(password), role]);
  return user;
}

// The defaults are for local development only. Set the SEED_* variables to use other passwords.
await upsertUser('Demo Admin', 'admin@example.org', process.env.SEED_ADMIN_PASSWORD || 'dev_admin_password', 'admin');
const expert = await upsertUser('Demo Legal Expert', 'expert@example.org', process.env.SEED_EXPERT_PASSWORD || 'dev_expert_password', 'legal_expert');
await upsertUser('Demo Student', 'test.student@alustudent.com', process.env.SEED_STUDENT_PASSWORD || 'dev_student_password', 'student');

// The directory. Every entry goes in as pending_review and never as published.
// The platform says a legal expert checks each entry against the body's own source before
// anyone is sent there. A seed that marked them verified would be self-verification.
// After seeding, sign in as the expert and work through the review queue.
const ENTRIES = [
  { name: 'Demo Pro-bono Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', location: 'Kigali',
    contact: 'via platform', services: 'Employment, tenancy and business matters. A sample entry for the demo.',
    languages: 'Kinyarwanda, English', is_free: true, user_id: expert.id },
  { name: 'Access to Justice Bureau (MAJ) of your district', category: 'consultant', type: 'maj_office',
    location: 'All thirty districts', contact: 'Walk in at the district office',
    services: 'Free legal advice and representation for people who cannot pay',
    languages: 'Kinyarwanda, English, French', is_free: true },
  { name: 'Legal Aid Forum', category: 'consultant', type: 'legal_aid', location: 'Kigali', contact: '1022',
    services: 'Free legal advice by telephone through a network of thirty-eight organisations',
    languages: 'Kinyarwanda, English, French', is_free: true },
  { name: 'Abunzi committee of your cell', category: 'organisation', type: 'abunzi', location: 'Every cell',
    contact: 'The cell office', services: 'Mediation of civil claims between individuals up to Frw 3,000,000',
    languages: 'Kinyarwanda', is_free: true },
  { name: 'District labour inspector', category: 'organisation', type: 'labour_inspector',
    location: 'Every district office', contact: 'The district labour inspectorate',
    services: 'Individual employment disputes: wages, contracts, dismissal',
    languages: 'Kinyarwanda, English, French', is_free: true },
  { name: 'Isange One Stop Centre', category: 'organisation', type: 'isange', location: '48 centres nationwide',
    contact: '3029 · 3512 · 116 for a child',
    services: 'Care, evidence, counselling and shelter for gender-based violence and child abuse. Telephone first because many centres do not open at night.',
    languages: 'Kinyarwanda, English, French', is_free: true },
  { name: 'Rwanda Investigation Bureau (RIB)', category: 'organisation', type: 'investigation',
    location: 'Nationwide', contact: '166', services: 'Reporting a crime',
    languages: 'Kinyarwanda, English, French', is_free: true },
  { name: 'Directorate General of Immigration and Emigration', category: 'organisation', type: 'immigration',
    location: 'Kigali', contact: 'IremboGov · 9090', services: 'Residence permits and student visas',
    languages: 'Kinyarwanda, English, French', is_free: false },
  { name: 'Office of the Registrar General (RDB)', category: 'organisation', type: 'business_registry',
    location: 'Kigali and online', contact: '1415',
    services: 'Business registration, free online, certificate with a tax number',
    languages: 'Kinyarwanda, English, French', is_free: true },
];
for (const e of ENTRIES) {
  await q(
    `INSERT INTO providers (name, category, type, location, contact, services, languages, is_free, user_id, status)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,'pending_review'
      WHERE NOT EXISTS (SELECT 1 FROM providers WHERE name = $1)`,
    [e.name, e.category, e.type, e.location, e.contact, e.services, e.languages, e.is_free, e.user_id ?? null]);
}
console.log(`✓ directory: ${ENTRIES.length} entries queued for the legal expert (nothing published)`);

// The crisis contacts. They are the same list the API falls back to when the table is empty.
for (const [i, c] of BUILT_IN_CONTACTS.entries()) {
  await q(
    `INSERT INTO emergency_contacts (name, contact, when_to_use, sort_order)
     SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM emergency_contacts WHERE name = $1)`,
    [c.name, c.contact, c.when, i + 1]);
}
console.log(`✓ crisis contacts: ${BUILT_IN_CONTACTS.length}`);

console.log('✓ seed complete');
console.log('  admin:   admin@example.org');
console.log('  expert:  expert@example.org');
console.log('  student: test.student@alustudent.com');
await pool.end();

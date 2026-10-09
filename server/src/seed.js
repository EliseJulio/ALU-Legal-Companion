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
    languages: 'Kinyarwanda, English', is_free: true, user_id: expert.id,
    // An obviously fake room. Replace it with the expert's real room before a live consultation.
    bookable: true, meet_link: 'https://meet.google.com/aaa-bbbb-ccc' },
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
    `INSERT INTO providers (name, category, type, location, contact, services, languages, is_free, user_id,
                            bookable, meet_link, status)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending_review'
      WHERE NOT EXISTS (SELECT 1 FROM providers WHERE name = $1)`,
    [e.name, e.category, e.type, e.location, e.contact, e.services, e.languages, e.is_free, e.user_id ?? null,
     e.bookable === true, e.meet_link ?? null]);
}
console.log(`✓ directory: ${ENTRIES.length} entries queued for the legal expert (nothing published)`);

// Where each kind of matter goes first. These also go in as pending_review.
const ROUTES = [
  { matter_type: 'small_civil_claim', forum: 'Abunzi committee of your cell',
    title: 'Someone owes me money, kept my deposit or broke an agreement (up to Frw 3,000,000)',
    keywords: 'deposit landlord rent tenant debt loan money owed broke agreement contract neighbour refund',
    legal_basis: 'Law No. 37/2016, Art. 10. The Ministry of Justice treats Abunzi mediation as a step before court.',
    exclusions: 'Not for a dispute with the State or with a company (Art. 11). If your landlord is a registered business, go to the Access to Justice Bureau instead.',
    steps: ['Take the matter to the Abunzi committee of the cell where it happened', 'If you disagree with the decision, appeal to the Abunzi committee of the sector', 'If you still disagree, take it to the Primary Court'],
    deadline_days: 30, deadline_runs_from: 'the sector committee decision', deadline_note: 'Law No. 37/2016, Art. 27' },
  { matter_type: 'employment_dispute', forum: 'District labour inspector',
    title: 'My employer has not paid me, gave me no written contract or dismissed me',
    keywords: 'wages salary pay unpaid job work employer fired dismissed internship contract probation boss',
    legal_basis: 'Law No. 66/2018, Art. 102. A court may refuse a case where this step was skipped.',
    exclusions: null,
    steps: ['Raise it with the workers’ representatives at your workplace if there are any', 'Take it to the labour inspector of your district', 'If it is not settled, go to the national labour inspector and then the court'],
    deadline_days: 730, deadline_runs_from: 'the day the dispute started', deadline_note: 'The claim lapses two years after the dispute starts (Art. 104).' },
  { matter_type: 'gender_based_violence', forum: 'Isange One Stop Centre',
    title: 'I have experienced sexual or gender-based violence or a child is being abused',
    keywords: 'rape assault abuse violence domestic sexual harassment child gbv beaten',
    legal_basis: 'Isange One Stop Centres provide care, evidence, counselling and shelter in one place.',
    exclusions: null,
    steps: ['If you are in danger now, call 112', 'Call 3029 (or 116 for a child) before travelling because many centres do not open at night', 'Go to the nearest Isange One Stop Centre'],
    deadline_days: null, deadline_runs_from: null, deadline_note: 'Go as soon as you can. Medical evidence is time-sensitive.' },
  { matter_type: 'report_a_crime', forum: 'Rwanda Investigation Bureau (RIB)',
    title: 'I want to report a crime',
    keywords: 'crime theft stolen robbery fraud scam threat police report criminal',
    legal_basis: 'Law No. 12/2017. The Bureau passes the file to the prosecution, which decides whether to charge (Law No. 14/2018, Art. 26).',
    exclusions: null,
    steps: ['Call 166 or report online', 'Keep any evidence such as messages, receipts and photos'],
    deadline_days: null, deadline_runs_from: null, deadline_note: null },
  { matter_type: 'residence_permit', forum: 'Directorate General of Immigration and Emigration',
    title: 'I need a residence permit or student visa or mine is about to expire',
    keywords: 'visa permit residence immigration student foreigner international expire expired renew',
    legal_basis: 'Directorate General of Immigration and Emigration.',
    exclusions: null,
    steps: ['Apply on IremboGov', 'Renew within five days of expiry or pay a penalty', 'Processing takes about seven days'],
    deadline_days: 15, deadline_runs_from: 'the day you arrived in Rwanda', deadline_note: null },
  { matter_type: 'register_business', forum: 'Office of the Registrar General (RDB)',
    title: 'I want to register a business',
    keywords: 'business company register registration startup freelance tax tin trade',
    legal_basis: 'Office of the Registrar General at the Rwanda Development Board.',
    exclusions: null,
    steps: ['Register online on the business registration website', 'Your certificate comes with a tax number'],
    deadline_days: null, deadline_runs_from: null, deadline_note: null },
  { matter_type: 'free_legal_advice', forum: 'Access to Justice Bureau (MAJ) of your district',
    title: 'I need free advice or a lawyer and I cannot pay',
    keywords: 'free lawyer advice legal aid cannot afford poor help representation',
    legal_basis: 'One Access to Justice Bureau in each of the thirty districts.',
    exclusions: null,
    steps: ['Walk in at the Access to Justice Bureau of your district'],
    deadline_days: null, deadline_runs_from: null, deadline_note: null },
  { matter_type: 'phone_advice', forum: 'Legal Aid Forum',
    title: 'I want free legal advice by telephone',
    keywords: 'phone telephone call advice free hotline',
    legal_basis: 'The Legal Aid Forum is a network of thirty-eight organisations.',
    exclusions: null,
    steps: ['Call 1022'],
    deadline_days: null, deadline_runs_from: null, deadline_note: null },
];
for (const r of ROUTES) {
  const [forum] = await q('SELECT id FROM providers WHERE name = $1', [r.forum]);
  await q(
    `INSERT INTO matter_routes (matter_type, title, keywords, first_forum_id, legal_basis, exclusions, steps,
                                deadline_days, deadline_runs_from, deadline_note, status)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending_review'
      WHERE NOT EXISTS (SELECT 1 FROM matter_routes WHERE matter_type = $1)`,
    [r.matter_type, r.title, r.keywords, forum.id, r.legal_basis, r.exclusions, r.steps,
     r.deadline_days, r.deadline_runs_from, r.deadline_note]);
}
console.log(`✓ routes: ${ROUTES.length} queued for the legal expert (nothing published)`);

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

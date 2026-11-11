// Starter accounts for development. Usage: npm run seed
// Safe to run again. An account that already exists is left as it is.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { q, pool } from './db.js';
import { hashPassword } from './passwords.js';
import { BUILT_IN_CONTACTS } from './routes/contacts.js';
import { validateService } from './services/guideService.js';
import { checklistFromGuide, insertPublishedChecklist } from './services/guideChecklists.js';
import { validateChecklist } from './services/checklists.js';
import { OFFICIAL_CHECKLISTS, linkGuide } from './services/officialChecklists.js';

// These accounts are created already verified. Login is blocked until an address is verified
// and there is no inbox behind these addresses.
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
const admin = await upsertUser('Platform Administrator', 'admin@example.org', process.env.SEED_ADMIN_PASSWORD || 'dev_admin_password', 'admin');
const expert = await upsertUser('Legal Expert', 'expert@example.org', process.env.SEED_EXPERT_PASSWORD || 'dev_expert_password', 'legal_expert');
await upsertUser('Aline Uwase', 'test.student@alustudent.com', process.env.SEED_STUDENT_PASSWORD || 'dev_student_password', 'student');

// The directory. Every entry goes in as a draft and never as published.
// An admin publishes each one after checking it.
const ENTRIES = [
  { name: 'Pro-bono lawyer in Kigali', category: 'lawyer', type: 'pro_bono_lawyer', location: 'Kigali',
    contact: 'via platform', services: 'Employment, tenancy and business matters.',
    languages: 'Kinyarwanda, English', is_free: true, user_id: expert.id,
    // A placeholder room for development only.
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
// The car route needs RRA and the vehicle inspection site, so both are listed. The inspection
// site's languages and fee are not known, so they are left empty. Its name is not changed: an
// existing row with the old name would be duplicated. The route below looks the entry up by this name.
ENTRIES.push(
  { name: 'Rwanda Revenue Authority (RRA)', category: 'organisation', type: 'other', location: 'Kigali',
    contact: 'RRA call centre 3004', services: 'Tax and the ownership transfer of a vehicle through RRA e-Tax',
    languages: 'Kinyarwanda, English, French', is_free: false },
  { name: 'Rwanda National Police, motor vehicle inspection (Control Technique), Remera', category: 'organisation',
    type: 'other', location: 'Kigali', contact: 'Book on IremboGov under Vehicle Technical Inspection & Emission Testing',
    services: 'Technical inspection and emission testing of a motor vehicle', status: 'draft',
    official_source_url: 'https://irembo.gov.rw/user/citizen/service/rnp/motor_vehicle_inspection_appointment' });
for (const e of ENTRIES) {
  await q(
    `INSERT INTO providers (name, category, type, location, contact, services, languages, is_free, user_id,
                            bookable, meet_link, official_source_url, status)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
      WHERE NOT EXISTS (SELECT 1 FROM providers WHERE name = $1)`,
    [e.name, e.category, e.type, e.location, e.contact, e.services, e.languages ?? null, e.is_free === true,
     e.user_id ?? null, e.bookable === true, e.meet_link ?? null, e.official_source_url ?? null,
     e.status ?? 'draft']);
}

// The head offices. Only what the body's own page states goes in. Anything it does not state goes
// in the note. An entry that is already published is left alone.
const ADDRESSES = {
  'Rwanda Investigation Bureau (RIB)': { address: 'KN5 Rd, Kamukina, Kigali (P.O. Box 137 Kigali)',
    hours: 'Monday to Friday, 8:00 AM to 5:00 PM',
    note: 'No plot number is published. 166 is for emergencies and crime information.' },
  'Directorate General of Immigration and Emigration': { address: 'KG 7 Ave, Kigali',
    hours: 'Monday to Friday, 8am to 5pm',
    note: 'The site gives the street only. It does not call it the head office. Call +250 788 152 222 before you travel.' },
  'Office of the Registrar General (RDB)': { address: 'RDB Building 1, KG 9 Avenue, Kigali (moving to KN 69 Street, Kigali)',
    hours: 'Monday to Thursday 09:00 to 17:00, Friday 09:00 to 15:00',
    note: 'RDB is moving from KG 9 Avenue to KN 69 Street. The move is not finished, so both addresses are in use. Call 1415 before you travel. Registration is online, so you rarely need to go.' },
  'Access to Justice Bureau (MAJ) of your district': { address: 'Ministry of Justice, KG 1 Roundabout, Kigali (P.O. Box 160 Kigali)',
    note: 'This is the address of the Ministry. No separate address is published for the national MAJ office. Walk in at your district office.' },
  'Legal Aid Forum': { address: 'Kimihurura, KN 14, KG 668 St, Kigali',
    hours: 'Monday to Thursday 08:00 to 17:00, Friday 08:00 to 15:00',
    note: 'No plot number or building name is published. The free helpline is 1022.' },
  'Isange One Stop Centre': { address: 'Kacyiru Hospital, Kigali',
    note: 'This is the main centre in Kigali. There are 48 centres across the country. Call 3029 first and ask for the nearest one.' },
  'District labour inspector': {
    note: 'Go to the labour inspector at your district office. At national level the Ministry of Public Service and Labour is on KG 7 Ave, Kacyiru, Kigali.' },
  'Rwanda Revenue Authority (RRA)': { address: 'Silverback Mall, Kicukiro Sonatubes, Kigali',
    note: 'This is the head office. RRA publishes no street name or plot number. Your appointment tells you which RRA motor vehicle office to go to.' },
  'Rwanda National Police, motor vehicle inspection (Control Technique), Remera': {
    address: 'Remera, Kigali',
    note: 'Not yet confirmed on an official page: the Remera site, the Rwanda National Police as its operator, and the Irembo booking link. The project author gave these. The fees and opening hours are not stated here. You book the visit on Irembo first, then go to the site.' },
};
for (const [name, a] of Object.entries(ADDRESSES)) {
  await q(
    `UPDATE providers SET address = $1, hours = $2, address_note = $3
      WHERE name = $4 AND status <> 'published' AND address IS NULL AND address_note IS NULL`,
    [a.address ?? null, a.hours ?? null, a.note ?? null, name]);
}
console.log(`✓ directory: ${ENTRIES.length} entries queued for the admin to publish (nothing published)`);

// Where each kind of matter goes first. These also go in as drafts.
const ROUTES = [
  { matter_type: 'small_civil_claim', area: 'tenancy', forum: 'Abunzi committee of your cell',
    title: 'Someone owes me money, kept my deposit or broke an agreement (up to Frw 3,000,000)',
    keywords: 'deposit landlord rent tenant debt loan money owed broke agreement contract neighbour refund',
    legal_basis: 'Law No. 37/2016, Art. 10. The Ministry of Justice treats Abunzi mediation as a step before court.',
    exclusions: 'Not for a dispute with the State or with a company (Art. 11). If your landlord is a registered business, go to the Access to Justice Bureau instead.',
    steps: ['Take the matter to the Abunzi committee of the cell where it happened', 'If you disagree with the decision, appeal to the Abunzi committee of the sector', 'If you still disagree, take it to the Primary Court'],
    deadline_days: 30, deadline_runs_from: 'the sector committee decision', deadline_note: 'Law No. 37/2016, Art. 27' },
  { matter_type: 'employment_dispute', area: 'employment', forum: 'District labour inspector',
    title: 'My employer has not paid me, gave me no written contract or dismissed me',
    keywords: 'wages salary pay unpaid job work employer fired dismissed internship contract probation boss',
    legal_basis: 'Law No. 66/2018, Art. 102. A court may refuse a case where this step was skipped.',
    exclusions: null,
    steps: ['Raise it with the workers’ representatives at your workplace if there are any', 'Take it to the labour inspector of your district', 'If it is not settled, go to the national labour inspector and then the court'],
    deadline_days: 730, deadline_runs_from: 'the day the dispute started', deadline_note: 'The claim lapses two years after the dispute starts (Art. 104).' },
  { matter_type: 'gender_based_violence', area: 'harassment', forum: 'Isange One Stop Centre',
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
  { matter_type: 'residence_permit', area: 'immigration', forum: 'Directorate General of Immigration and Emigration',
    title: 'I need a residence permit or student visa or mine is about to expire',
    keywords: 'visa permit residence immigration student foreigner international expire expired renew',
    legal_basis: 'Directorate General of Immigration and Emigration.',
    exclusions: null,
    steps: ['Apply on IremboGov', 'Renew within five days of expiry or pay a penalty', 'Processing takes about seven days'],
    deadline_days: 15, deadline_runs_from: 'the day you arrived in Rwanda', deadline_note: null },
  { matter_type: 'register_business', area: 'business', forum: 'Office of the Registrar General (RDB)',
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
  // Cars and driving. No law or deadline is stated for this route.
  { matter_type: 'vehicle_inspection', area: 'vehicles', status: 'draft',
    forum: 'Rwanda National Police, motor vehicle inspection (Control Technique), Remera',
    title: 'I need a technical inspection for my vehicle',
    keywords: 'vehicle car inspection technical emission test motor irembo remera',
    legal_basis: 'Not yet confirmed. No law or article has been checked for this route yet.',
    exclusions: null,
    steps: ['Book the vehicle inspection on Irembo, under Vehicle Technical Inspection & Emission Testing', 'Take the car to the Rwanda National Police inspection site at Remera on the day you booked'],
    deadline_days: null, deadline_runs_from: null, deadline_note: null },
];
for (const r of ROUTES) {
  const [forum] = await q('SELECT id FROM providers WHERE name = $1', [r.forum]);
  await q(
    `INSERT INTO matter_routes (matter_type, title, keywords, first_forum_id, legal_basis, exclusions, steps,
                                deadline_days, deadline_runs_from, deadline_note, area, status)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      WHERE NOT EXISTS (SELECT 1 FROM matter_routes WHERE matter_type = $1)`,
    [r.matter_type, r.title, r.keywords, forum.id, r.legal_basis, r.exclusions, r.steps,
     r.deadline_days, r.deadline_runs_from, r.deadline_note, r.area ?? null, r.status ?? 'draft']);
}
console.log(`✓ routes: ${ROUTES.length} queued (nothing published; the car route is a draft)`);

// The steps of the dispute ladder. They go in as drafts, so nothing is shown until an admin
// publishes each step. The appeal clock on the Umurenge step is not checked against the route's clock.
const LADDER = [
  { position: 1, title: 'Umudugudu (Village)', tagline: 'Community level',
    description: 'First informal mediation by the Village Executive Committee. Best for quick neighbourhood resolutions.',
    law_cited: '' },
  { position: 2, title: 'Akagari (Cell Abunzi)', tagline: 'Mandatory first legal stop',
    description: 'Mandatory mediation for civil and property claims up to FRW 3,000,000 (Law N° 37/2016). Formal court cases can be dismissed if this is skipped.',
    law_cited: 'Law N° 37/2016' },
  { position: 3, title: 'Umurenge (Sector Abunzi)', tagline: 'Mediation appeals',
    description: 'Appeals against Cell Abunzi decisions must be filed here within 30 days of the ruling.',
    law_cited: '' },
  { position: 4, title: 'Urukiko rw\'Ibanze (Primary Court)', tagline: 'Judicial court of first instance',
    description: 'Hears formal lawsuits if Sector Abunzi mediation fails, or for claims exceeding FRW 3,000,000.',
    law_cited: '' },
];
for (const s of LADDER) {
  await q(
    `INSERT INTO dispute_ladder_steps (position, title, tagline, description, law_cited, status)
     SELECT $1,$2,$3,$4,$5,'draft'
      WHERE NOT EXISTS (SELECT 1 FROM dispute_ladder_steps WHERE title = $2)`,
    [s.position, s.title, s.tagline, s.description, s.law_cited]);
}
console.log(`✓ dispute ladder: ${LADDER.length} steps queued as drafts (nothing published)`);

// A starter guide. It goes in as a draft.
await q(
  `INSERT INTO guides (domain, title, situation, law_says, your_rights, steps, get_help, source_law, source_url, status)
   SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,'draft'
    WHERE NOT EXISTS (SELECT 1 FROM guides WHERE title = $2)`,
  [
    'employment',
    'Internship and first job contracts: know your rights',
    'You have been offered an internship or your first job in Rwanda. You are not sure what should be in the contract. You are not sure whether the probation rules protect you. You do not know what to do if something goes wrong.',
    'If you are engaged for 3 months or more the contract must be in writing. A foreign national must always receive a written contract. A probation period cannot be longer than 3 months. It can be renewed once for at most 3 more months and only with a written evaluation shared with you. Notice of termination must be in writing and state the reasons. Only gross misconduct allows dismissal without notice. Your contract must state your pay and your weekly working hours. (Law No. 66/2018. The admin checks the current articles on amategeko.gov.rw before this guide is published.)',
    'You are entitled to a written contract for work of 3 months or more. You are entitled to a probation period of at most 3 months plus 3 with a written evaluation. You are entitled to written reasons for any termination and to the pay stated in your contract. Signing as an "intern" does not remove these protections when you do real work under an employer’s direction.',
    '1. Before signing, read the contract and check the duration, pay, working hours and probation length. 2. Keep copies of the signed contract, your payslips and any written evaluations. 3. If a problem arises, raise it in writing with your employer first. 4. If it is not settled, contact the district labour inspector, which is free. You can also go to an Access to Justice Bureau.',
    'District labour inspector: free complaints and mediation. Access to Justice Bureau (MAJ): free legal aid in every district. You can book a session with a pro-bono lawyer through this platform.',
    'Law No. 66/2018 of 30/08/2018 Regulating Labour in Rwanda',
    'https://www.amategeko.gov.rw/',
  ]);
console.log('✓ guides: 1 sample guide queued for the admin to publish');

// Two more guides with a "how to do it" part. They are only queued for the admin. Nothing
// here publishes. A walkthrough step points at the page it happens on (such as Irembo's own
// support article) rather than a screenshot. The service part is checked by the same rules as
// an admin's save.
const GUIDES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed-data', 'guides');
for (const file of ['student-permit-renewal.json', 'vehicle-ownership-transfer.json']) {
  const draft = JSON.parse(await fs.readFile(path.join(GUIDES_DIR, file), 'utf8'));
  const [already] = await q('SELECT id FROM guides WHERE title = $1', [draft.title]);
  if (already) continue;
  const checked = validateService(draft.service);
  if (checked.errors) throw new Error(`${file}: ${checked.errors.join('; ')}`);
  await q(
    `INSERT INTO guides (domain, title, situation, law_says, your_rights, steps, get_help, source_law, source_url, service, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')`,
    [draft.domain, draft.title, draft.situation, draft.law_says, draft.your_rights, draft.steps, draft.get_help,
     draft.source_law, draft.source_url, checked.value]);
  console.log(`✓ guides: "${draft.title}" queued for the admin to publish`);
}

// Document checklists, published with the administrator account as the publisher. An existing row is never
// changed, except that a missing guide link is filled in.
const RRA_PAGE = 'https://www.rra.gov.rw/en/domestic-tax-services/motor-vehicle-services/motor-vehicle-ownership-transfer';
const RRA_PDF = 'https://www.rra.gov.rw/fileadmin/user_upload/OWNERSHIP_TRANSFER_REQUIREMENTS.pdf';
const CHECKLISTS = [
  {
    slug: 'buying-a-second-hand-car',
    title: 'Buying a second-hand car',
    description: 'The documents RRA asks for to move a second-hand car into your name. Drawn from RRA\'s own pages (October 2026). Not confirmed on RRA\'s pages so ask RRA. A "Tracking Code" that news reports say the seller makes in e-Tax. How long a transfer takes. The transfer is done on RRA\'s e-Tax portal and not on Irembo.',
    items: [
      { key: 'sale-agreement', name: 'Notarized sale agreement', required: true, source_url: RRA_PDF,
        notes: 'Signed by the seller and the buyer. It must state the sale price. It must show that it was paid in full. It must give the seller\'s valid Rwandan ID or passport, the plate and chassis numbers, both signatures and the date. A sale made abroad needs the Rwandan Embassy and MINAFFET or an apostille.',
        where_to_get: 'A private notary' },
      { key: 'buyer-id', name: 'Your ID or passport (copy)', required: true, source_url: RRA_PDF,
        notes: 'Scan it as a clear PDF.', where_to_get: 'NIDA for a Rwandan national ID' },
      { key: 'seller-id', name: 'The seller\'s ID or passport (copy)', required: true, source_url: RRA_PDF,
        notes: 'Scan it as a clear PDF.', where_to_get: 'The seller' },
      { key: 'buyer-tin', name: 'Your Tax Identification Number (TIN)', required: true, source_url: RRA_PAGE,
        notes: 'Needed in every case.', where_to_get: 'RRA' },
      { key: 'yellow-card', name: 'The car\'s latest yellow card (registration card)', required: true, source_url: RRA_PAGE,
        notes: 'The old plates and the registration card are handed back on the day of the transfer.', where_to_get: 'The seller' },
      { key: 'insurance', name: 'Motor-vehicle insurance records', required: true, source_url: RRA_PDF,
        notes: 'One year of insurance records for a private car.', where_to_get: 'The insurance company' },
      { key: 'fee-receipt', name: 'Proof you paid the transfer fee', required: true, source_url: RRA_PAGE,
        notes: 'FRW 60,000 for a car (FRW 30,000 for a motorcycle). You pay it inside the e-Tax request. The request is cancelled if it is not paid.',
        where_to_get: 'Paid on RRA e-Tax' },
      { key: 'seller-taxes', name: 'The seller\'s taxes are settled', required: false, source_url: RRA_PAGE,
        notes: 'RRA checks that the seller has no tax arrears before it approves. Ask the seller to settle any before you start.',
        where_to_get: 'The seller with RRA' },
      { key: 'ebm-invoice', name: 'EBM invoice', required: false, required_if: 'the seller is VAT-registered or it is a business sale',
        source_url: RRA_PAGE, where_to_get: 'The seller\'s EBM system' },
      { key: 'company-documents', name: 'Company or organisation documents', required: false,
        required_if: 'the buyer or the seller is a company, NGO or cooperative', source_url: RRA_PDF,
        notes: 'The registration certificate, the board or assembly resolution and the legal representative\'s appointment letter.',
        where_to_get: 'RDB, RGB or RCA and the organisation itself' },
      { key: 'power-of-attorney', name: 'Notarized power of attorney and the ID of the person collecting', required: false,
        required_if: 'someone else collects the plates and logbook', source_url: RRA_PAGE,
        notes: 'The ID must match the person named.', where_to_get: 'A notary' },
    ],
  },
];
// The checklists borrowed from the guides. The items are the guide's own documents.
const GUIDE_CHECKLISTS = [
  { file: 'student-permit-renewal.json', slug: 'student-permit-renewal', title: 'Renewing a student permit',
    description: 'The documents to have ready before you renew a student residence permit (Class U1) on Irembo. Based on the guide "Renewing Your Student Residence Permit (Class U1)".' },
];
// The car list above is the checklist for the car guide. Only the link to its guide is added.
const CAR_GUIDE_FILE = 'vehicle-ownership-transfer.json';

const guideIdFor = async (file) => {
  const draft = JSON.parse(await fs.readFile(path.join(GUIDES_DIR, file), 'utf8'));
  const [g] = await q('SELECT id FROM guides WHERE title = $1', [draft.title]);
  return { draft, guideId: g?.id ?? null };
};

for (const c of CHECKLISTS) {
  await insertPublishedChecklist(q, { ...c, items: c.items }, { adminId: admin.id });
}
const car = await guideIdFor(CAR_GUIDE_FILE);
await q('UPDATE document_checklists SET guide_id = $1 WHERE slug = $2 AND guide_id IS NULL',
  [car.guideId, CHECKLISTS[0].slug]);
for (const g of GUIDE_CHECKLISTS) {
  const { draft, guideId } = await guideIdFor(g.file);
  const checklist = checklistFromGuide(draft, { slug: g.slug, title: g.title, description: g.description });
  await insertPublishedChecklist(q, checklist, { guideId, adminId: admin.id });
}
// Two checklists from official pages. Each is linked to its guide when that guide exists.
for (const { guideTitle, ...c } of OFFICIAL_CHECKLISTS) {
  const checked = validateChecklist(c);
  if (checked.errors) throw new Error(`${c.slug}: ${checked.errors.join('; ')}`);
  await insertPublishedChecklist(q, checked.value, { adminId: admin.id });
  await linkGuide(q, c.slug, guideTitle);
}
console.log(`✓ checklists: ${CHECKLISTS.length + GUIDE_CHECKLISTS.length + OFFICIAL_CHECKLISTS.length} published`);

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

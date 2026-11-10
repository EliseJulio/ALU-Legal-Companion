// Two checklists written from official pages, not from a guide.
// Only what the page says is here. A detail typed into a form is an item that is not required,
// so a matter can still show "ready" without a file for it.

const MIFOTRA = 'https://www.mifotra.gov.rw/fileadmin/user_upload/Mifotra/Publication/10.QUALITY_SERVICE_DELIVERY_STANDARDS/MIFOTRA_SERVICE_DELIVERY_COMMITMENT_CHARTER.pdf';
const RDB_REQ = 'https://org.rdb.rw/business-registration/requirements/';
const RDB = 'https://org.rdb.rw/business-registration/';

export const OFFICIAL_CHECKLISTS = [
  {
    slug: 'labour-complaint-to-the-labour-inspector',
    title: 'Complaining to the labour inspector',
    guideTitle: 'A Problem at Work: How to Use a Labour Inspector',
    description: 'What to send the labour inspector of your district with a labour dispute. Based on the MIFOTRA Service Commitment Charter approved on 18/11/2021 (service 20, labour dispute mediation), read on 6 Nov 2026.',
    items: [
      { key: 'request-letter', name: 'Request letter to the labour inspector', required: true, source_url: MIFOTRA,
        notes: 'A letter that submits the labour dispute to the labour inspector of your district.',
        where_to_get: 'You write it' },
      { key: 'employment-contract', name: 'Copy of the employment contract', required: false, required_if: 'you have an employment contract',
        source_url: MIFOTRA, notes: 'The charter says "if any". Only if you have a contract. If you have none, you can still send the other papers.',
        where_to_get: 'Your copy of the contract' },
      { key: 'evidence', name: 'Evidence of the labour dispute', required: true, source_url: MIFOTRA,
        notes: 'The charter does not list what counts. Examples are payslips, messages and written notices. Bring what shows the problem.',
        where_to_get: 'Your own records' },
      { key: 'contact-details', name: 'Contact and address details of you and your employer', required: false, source_url: MIFOTRA,
        notes: 'Written in the request letter. Nothing separate to upload.',
        where_to_get: 'You write them in the letter' },
    ],
  },
  {
    slug: 'registering-a-business-with-rdb',
    title: 'Registering a business with RDB',
    guideTitle: 'Starting a Small Business or Freelancing as a Student',
    description: 'What RDB asks for to register a business online. Based on RDB\'s business registration pages, read on 6 Nov 2026. Other papers may be asked for depending on the type of business: ask RDB.',
    items: [
      { key: 'id-or-passport', name: 'ID card (Rwandan) or passport', required: true, source_url: RDB_REQ,
        notes: 'RDB lists it for an individual enterprise and for a private company owned by a person.', where_to_get: 'NIDA for a Rwandan ID card' },
      { key: 'email-address', name: 'An active email address', required: false, source_url: RDB_REQ,
        notes: 'Typed into the online form, nothing to upload.', where_to_get: 'Your own email' },
      { key: 'company-name', name: 'Company name', required: false, source_url: RDB,
        notes: 'For a company. Typed into the online form, nothing to upload.' },
      { key: 'business-activities', name: 'Planned business activities', required: false, source_url: RDB,
        notes: 'For a company. Typed into the online form, nothing to upload.' },
      { key: 'local-address', name: 'A local, physical address for the company', required: false, source_url: RDB,
        notes: 'For a company. Typed into the online form, nothing to upload.' },
      { key: 'owner-particulars', name: 'Particulars of shareholders, board members and directors', required: false, source_url: RDB,
        notes: 'For a company. Typed into the online form, nothing to upload.' },
      { key: 'shareholders-resolution', name: 'Notarized shareholders resolution', required: false,
        required_if: 'you open a subsidiary, a joint venture or a branch', source_url: RDB_REQ,
        notes: 'Only if you open a subsidiary, a joint venture or a branch. It states the name, scope of business, management and shareholding of the new company. For a branch it also names the branch representative who lives in Rwanda. It must be signed in front of the notary.',
        where_to_get: 'A notary' },
      { key: 'foreign-company-papers', name: 'Certificate of incorporation and articles of association of the foreign company', required: false,
        required_if: 'a foreign company is a shareholder, or the parent of a subsidiary, joint venture or branch', source_url: RDB_REQ,
        notes: 'Only if a foreign company is involved. RDB asks for notarized copies.', where_to_get: 'The foreign company, then a notary' },
      { key: 'rgb-rca-registration', name: 'Proof of registration with the Rwanda Governance Board or the Rwanda Cooperatives Agency, and a board resolution', required: false,
        required_if: 'the owner is an NGO, an association or a cooperative', source_url: RDB,
        notes: 'Only for an NGO, an association or a cooperative. The board resolution opens up the business.',
        where_to_get: 'RGB or RCA, and the organisation\'s board' },
      { key: 'police-authorization', name: 'Authorization from the National Police', required: false,
        required_if: 'the business is in defence or investigation activities', source_url: RDB,
        notes: 'Only for defence and investigation activities.', where_to_get: 'The Rwanda National Police' },
    ],
  },
];

// Links a checklist to its guide by the guide's exact title. No guide: nothing changes.
// A row that already has a guide is left alone. No guide is edited.
export async function linkGuide(q, slug, guideTitle) {
  const [g] = await q('SELECT id FROM guides WHERE title = $1 ORDER BY id LIMIT 1', [guideTitle]);
  if (!g) return null;
  await q('UPDATE document_checklists SET guide_id = $1 WHERE slug = $2 AND guide_id IS NULL', [g.id, slug]);
  return g.id;
}

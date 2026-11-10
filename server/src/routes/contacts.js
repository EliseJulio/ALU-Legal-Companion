// Crisis and referral contacts. A person in a crisis must always be able to see them.
import { Router } from 'express';
import { q } from '../db.js';

const router = Router();

// This list is used only when the table is empty or cannot be read. A fresh database or a
// deleted last row would otherwise leave the crisis page empty. When the table has rows,
// it replaces this list.
export const BUILT_IN_CONTACTS = [
  { name: 'Police (emergency)', contact: '112', when: 'Immediate danger or crime in progress' },
  { name: 'Isange One Stop Centre', contact: '3029', when: 'Gender-based violence, abuse or harassment. Medical, psychological and legal support in one place' },
  { name: 'Ministry of Public Service and Labour (MIFOTRA)', contact: '0785569165', when: 'Workplace or internship disputes. Also reachable by email at info@mifotra.gov.rw' },
  { name: 'Directorate General of Immigration (DGIE)', contact: 'migration.gov.rw', when: 'Visa or residence permit emergencies' },
  { name: 'Maison d’Accès à la Justice (MAJ)', contact: 'Nearest district office', when: 'Free legal aid for any legal problem' },
];

// GET /api/emergency-contacts
// The column when_to_use is sent as "when". A client should not need to know the column name.
router.get('/', async (_req, res) => {
  try {
    const rows = await q(
      'SELECT name, contact, when_to_use AS "when" FROM emergency_contacts ORDER BY sort_order, id');
    return res.json(rows.length ? rows : BUILT_IN_CONTACTS);
  } catch {
    // Still answers when the database is down, so the page is never empty.
    return res.json(BUILT_IN_CONTACTS);
  }
});

export default router;

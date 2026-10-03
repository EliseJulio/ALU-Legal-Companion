// Admin: managing the directory entries.
// More admin pages are added here later (invites, users, contacts, statistics).
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { PROVIDER_CHECKED_FIELDS } from './directory.js';

const router = Router();

// The kinds of body in the directory. They are checked before saving so the admin is told
// which word was wrong. The database would refuse a bad type too but as a server error.
export const PROVIDER_TYPES = [
  'pro_bono_lawyer', 'maj_office', 'labour_inspector', 'abunzi', 'isange', 'investigation',
  'immigration', 'business_registry', 'legal_aid', 'ombudsman', 'human_rights', 'other',
];

// An empty value is fine. Anything else must be a full https:// address.
function sourceUrlError(value) {
  if (value === null || value === undefined || value === '') return null;
  let url;
  try { url = new URL(String(value)); } catch { return 'official_source_url must be a full https:// address'; }
  if (url.protocol !== 'https:') return 'official_source_url must start with https://';
  return null;
}

// POST /api/admin/providers: an admin adds an entry.
// A new entry is always a draft, whatever the request says. Publishing is a legal expert's step.
router.post('/providers', requireAuth('admin'), async (req, res) => {
  const { name, type, location, contact, services, languages, is_free, official_source_url } = req.body || {};
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  if (!PROVIDER_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${PROVIDER_TYPES.join(', ')}` });
  const linkError = sourceUrlError(official_source_url);
  if (linkError) return res.status(400).json({ error: linkError });

  const [provider] = await q(
    `INSERT INTO providers (name, type, location, contact, services, languages, is_free, official_source_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, type, location || null, contact || null, services || null, languages || null, !!is_free,
     official_source_url || null]);
  res.status(201).json(provider);
});

// PUT /api/admin/providers/:id: an admin edits an entry.
router.put('/providers/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [existing] = await q('SELECT * FROM providers WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Provider not found' });

  // A field that was not sent keeps its value. A field sent as null is cleared.
  const f = (k) => (Object.prototype.hasOwnProperty.call(req.body || {}, k) ? req.body[k] : existing[k]);

  // Everything is checked before saving, so a refused edit changes nothing.
  if (!f('name')) return res.status(400).json({ error: 'name is required' });
  if (!PROVIDER_TYPES.includes(f('type'))) return res.status(400).json({ error: `type must be one of: ${PROVIDER_TYPES.join(', ')}` });
  const linkError = sourceUrlError(f('official_source_url'));
  if (linkError) return res.status(400).json({ error: linkError });

  // If a fact that readers rely on really changed, the entry goes back to draft and loses its
  // verifier until a legal expert checks it again. Sending the same values again is not a change.
  const norm = (v) => (v === undefined || v === '' ? null : v);
  const factChanged = PROVIDER_CHECKED_FIELDS.some((k) => norm(f(k)) !== norm(existing[k]));
  const resetSql = factChanged ? `, status='draft', verified_by=NULL, verified_at=NULL` : '';

  const [provider] = await q(
    `UPDATE providers SET name=$1, type=$2, location=$3, contact=$4, services=$5, languages=$6,
            is_free=$7, official_source_url=$8, updated_at=now()${resetSql}
      WHERE id=$9 RETURNING *`,
    [f('name'), f('type'), norm(f('location')), norm(f('contact')), norm(f('services')),
     norm(f('languages')), !!f('is_free'), norm(f('official_source_url')), req.params.id]);
  res.json(provider);
});

export default router;

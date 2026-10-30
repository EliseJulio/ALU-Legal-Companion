// Admin: invitations for legal experts, user management, crisis contacts and counts.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, normalizeEmail } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { createInvite, deleteInvite } from '../services/invites.js';
import { sendMail, appUrl } from '../services/mailer.js';
import { STALE_AFTER_DAYS } from './directory.js';

const router = Router();

// ------------------------------------------------------------------------------ invitations
//
// The invitation is the only way to become a legal expert. It is emailed to the person.
// The admin never sees the token so the admin cannot use it to sign in as the expert.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/admin/invites { email, expires_days }
router.post('/invites', requireAuth('admin'), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'email is required' });
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'That is not a valid email address' });

  const days = req.body?.expires_days === undefined ? 7 : req.body.expires_days;
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    return res.status(400).json({ error: 'expires_days must be a whole number from 1 to 30' });
  }

  const [existing] = await q('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) return res.status(400).json({ error: 'An account with this email already exists' });

  const { invite, raw } = await createInvite(email, days, req.user.id);
  try {
    const delivery = await sendMail({
      to: email,
      subject: 'You are invited to ALU Legal Companion as a legal expert',
      text: [
        'Hello,',
        '',
        'You have been invited to join ALU Legal Companion as a legal expert and consultant.',
        'You will answer questions, hold consultations and check documents that people share with you.',
        'Use this link to choose a name and a password:',
        `${appUrl()}/redeem-invite?token=${encodeURIComponent(raw)}`,
        '',
        `The link works once and expires in ${days} ${days === 1 ? 'day' : 'days'}.`,
        'If you did not expect this invitation you can ignore this message.',
      ].join('\n'),
    });
    res.status(201).json({
      ...invite,
      message: delivery.delivered === false
        ? 'The invitation was created. This server has no mail set up, so the link is printed in the server log.'
        : `The invitation was sent to ${email}.`,
    });
  } catch (err) {
    // An invitation nobody received is not worth keeping. Say so and let the admin try again.
    console.error(`Could not send the invitation for ${invite.id}: ${err.message}`);
    await deleteInvite(invite.id);
    res.status(502).json({ error: 'The invitation email could not be sent. Check the mail settings and try again.' });
  }
});

// GET /api/admin/invites: the invitations and their state. The token is never in the list.
router.get('/invites', requireAuth('admin'), async (_req, res) => {
  res.json(await q(
    `SELECT i.id, i.email, i.expires_at, i.used_at, i.created_at, u.name AS invited_by,
            CASE WHEN i.used_at IS NOT NULL THEN 'used'
                 WHEN i.expires_at <= now() THEN 'expired'
                 ELSE 'pending' END AS status
       FROM invite_tokens i JOIN users u ON u.id = i.created_by
      ORDER BY i.created_at DESC, i.id DESC`));
});

// ------------------------------------------------------------------------------ users
//
// This is the largest amount of personal data the platform shows. It exists only because
// managing accounts needs it. The fields are the ones that job needs: name, email, role,
// whether the address is verified, whether the account is active and when it was made.
// The columns are listed one by one. A plain SELECT * would put every password hash in a browser.
// There are no counts of what a person has asked or booked. A column like that next to a
// name would turn account management into watching people.
const USER_COLUMNS = 'id, name, email, role, email_verified_at, deactivated_at, created_at';

router.get('/users', requireAuth('admin'), async (_req, res) => {
  res.json(await q(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at DESC, id DESC`));
});

// How many admins could still sign in if this one were not an admin any more.
// Reaching zero is the one mistake the platform cannot undo. Nobody could promote or
// reactivate anyone and the fix would be to edit the database by hand.
async function otherActiveAdmins(excludeUserId) {
  const [row] = await q(
    `SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND deactivated_at IS NULL AND id <> $1`,
    [excludeUserId]);
  return row.n;
}

const ASSIGNABLE_ROLES = ['student', 'staff', 'admin'];

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const { role } = req.body || {};

  // legal_expert cannot be given here. Only an invitation gives it. The link proves the person
  // owns the address before they can answer questions and hold consultations. A drop-down would remove that proof.
  if (role === 'legal_expert') {
    return res.status(400).json({
      error: 'Legal experts join by invitation only. Send an invitation instead. The link proves they own the address before they can answer questions and hold consultations.',
    });
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` });
  }

  const [target] = await q('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found' });

  // A legal expert's role stays as it is. Entries in the directory and the booking inbox are
  // tied to the account. A new role would leave them with nobody behind them.
  if (target.role === 'legal_expert') {
    return res.status(400).json({ error: 'The role of a legal expert cannot be changed. Switch the account off instead.' });
  }

  if (target.role === 'admin' && role !== 'admin' && (await otherActiveAdmins(target.id)) === 0) {
    return res.status(400).json({
      error: 'This is the last active admin. Promote another account to admin first. Otherwise nobody would be left to manage the platform.',
    });
  }

  const [updated] = await q(`UPDATE users SET role = $1 WHERE id = $2 RETURNING ${USER_COLUMNS}`, [role, target.id]);
  res.json(updated);
});

// POST /api/admin/users/:id/deactivate
// An account is switched off and never deleted. Guides and directory entries point at the
// person who checked them and a delete would break that.
router.post('/users/:id/deactivate', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account. Ask another admin to do it.' });
  }
  // COALESCE keeps the first time access was withdrawn if the button is pressed twice.
  // session_version goes up so the person's old tokens stay dead even if the account is
  // switched on again later.
  const [updated] = await q(
    `UPDATE users SET deactivated_at = COALESCE(deactivated_at, now()), session_version = session_version + 1
      WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [req.params.id]);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json(updated);
});

// POST /api/admin/users/:id/reactivate
router.post('/users/:id/reactivate', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [updated] = await q(
    `UPDATE users SET deactivated_at = NULL WHERE id = $1 RETURNING ${USER_COLUMNS}`, [req.params.id]);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json(updated);
});

// ------------------------------------------------------------------------------ crisis contacts
//
// An admin can correct a wrong number without a deploy. Deleting the last one is allowed.
// The public list falls back to the built-in contacts when the table is empty, so the crisis
// page can never be empty. That is what makes deleting safe.

const MAX_SORT = 10000;

// Returns a message for the first problem found or null. It runs on the merged contact.
function contactError(c) {
  for (const [field, max] of [['name', 200], ['contact', 200], ['when_to_use', 500]]) {
    if (typeof c[field] !== 'string' || !c[field]) return 'name, contact and when_to_use are all required';
    if (c[field].length > max) return `${field} must be ${max} characters or fewer`;
  }
  if (!Number.isInteger(c.sort_order) || c.sort_order < 0 || c.sort_order > MAX_SORT) {
    return `sort_order must be a whole number from 0 to ${MAX_SORT}`;
  }
  return null;
}

const clean = (v) => (typeof v === 'string' ? v.trim() : v);
const CONTACT_COLUMNS = 'id, name, contact, when_to_use, sort_order, updated_at';

router.get('/emergency-contacts', requireAuth('admin'), async (_req, res) => {
  res.json(await q(`SELECT ${CONTACT_COLUMNS} FROM emergency_contacts ORDER BY sort_order, id`));
});

router.post('/emergency-contacts', requireAuth('admin'), async (req, res) => {
  const b = req.body || {};
  const c = {
    name: clean(b.name), contact: clean(b.contact), when_to_use: clean(b.when_to_use),
    sort_order: b.sort_order === undefined ? 100 : b.sort_order,
  };
  const error = contactError(c);
  if (error) return res.status(400).json({ error });
  const [row] = await q(
    `INSERT INTO emergency_contacts (name, contact, when_to_use, sort_order) VALUES ($1,$2,$3,$4)
     RETURNING ${CONTACT_COLUMNS}`,
    [c.name, c.contact, c.when_to_use, c.sort_order]);
  res.status(201).json(row);
});

// A key the request did not send keeps its value.
router.put('/emergency-contacts/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [existing] = await q('SELECT * FROM emergency_contacts WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Contact not found' });
  const has = (k) => Object.prototype.hasOwnProperty.call(req.body || {}, k);
  const c = {};
  for (const k of ['name', 'contact', 'when_to_use']) c[k] = has(k) ? clean(req.body[k]) : existing[k];
  c.sort_order = has('sort_order') ? req.body.sort_order : existing.sort_order;
  const error = contactError(c);
  if (error) return res.status(400).json({ error });
  const [row] = await q(
    `UPDATE emergency_contacts SET name=$1, contact=$2, when_to_use=$3, sort_order=$4, updated_at=now()
      WHERE id=$5 RETURNING ${CONTACT_COLUMNS}`,
    [c.name, c.contact, c.when_to_use, c.sort_order, existing.id]);
  res.json(row);
});

router.delete('/emergency-contacts/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [row] = await q('DELETE FROM emergency_contacts WHERE id = $1 RETURNING id', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Contact not found' });
  res.status(204).end();
});

// ------------------------------------------------------------------------------ counts
//
// Counts only. No names, no emails and nothing about what one person did.

// Turns rows of { status, n } into an object that has every key with 0 for the missing ones.
const counts = (keys, rows, field = 'status') => {
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const r of rows) if (r[field] in out) out[r[field]] = r.n;
  return out;
};
const REVIEW_STATES = ['draft', 'pending_review', 'published'];

router.get('/stats', requireAuth('admin'), async (_req, res) => {
  const byStatus = (table) => q(`SELECT status, count(*)::int AS n FROM ${table} GROUP BY status`);
  const [staleRow] = await q(
    `SELECT count(*)::int AS n FROM providers
      WHERE status = 'published' AND (last_checked_at IS NULL OR last_checked_at < CURRENT_DATE - ${STALE_AFTER_DAYS})`);
  const [bookings] = await q(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE user_id IS NULL)::int AS anonymous FROM bookings`);
  const [questions] = await q(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE user_id IS NULL)::int AS anonymous,
            count(*) FILTER (WHERE status = 'open')::int AS open FROM questions`);
  const [matters] = await q(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'open')::int AS open,
            count(*) FILTER (WHERE shared_with IS NOT NULL)::int AS shared FROM matters`);
  const [late] = await q(
    `SELECT count(*)::int AS n FROM reminders
      WHERE status = 'sent' AND (sent_at AT TIME ZONE 'Africa/Kigali')::date > due_on`);
  const [deactivated] = await q('SELECT count(*)::int AS n FROM users WHERE deactivated_at IS NOT NULL');

  res.json({
    guides: counts(REVIEW_STATES, await byStatus('guides')),
    directory: {
      providers: counts(REVIEW_STATES, await byStatus('providers')),
      routes: counts(REVIEW_STATES, await byStatus('matter_routes')),
      stale: staleRow.n,
    },
    bookings: {
      ...bookings,
      by_status: counts(['requested', 'accepted', 'declined', 'completed'], await byStatus('bookings')),
    },
    questions,
    matters,
    reminders: {
      ...counts(['pending', 'sent', 'missed', 'cancelled'], await byStatus('reminders')),
      sent_late: late.n,
    },
    users: {
      ...counts(['student', 'staff', 'legal_expert', 'admin'],
        await q('SELECT role, count(*)::int AS n FROM users GROUP BY role'), 'role'),
      deactivated: deactivated.n,
    },
  });
});

export default router;

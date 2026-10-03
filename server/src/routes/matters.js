// Matters: a person's own record of a legal problem. What they did, what comes next, the
// deadline and reminders before it.
//
// A matter is private to the user who made it. Every read goes through loadMatter, which
// answers 404 (not 403) for a matter the caller may not see, so nobody can tell it exists.
// There are no anonymous matters: a lasting record cannot be untraceable.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam, isValidId } from '../middleware/validate.js';
import { scheduleReminders, isDateString, addDays, kigaliToday } from '../services/reminders.js';

const router = Router();
const OWNERS = ['student', 'staff'];
const MAX_TITLE = 200;
const MAX_TEXT = 2000;

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

// The one place that decides who may see a matter. The owner always can. A legal expert can
// only while the matter is shared with a directory entry linked to their login. Anyone else
// gets nothing.
export async function loadMatter(matterId, user) {
  const [m] = await q(
    `SELECT m.*, r.title AS route_title, p.name AS shared_with_name, p.user_id AS shared_with_user
       FROM matters m
       LEFT JOIN matter_routes r ON r.id = m.route_id
       LEFT JOIN providers p ON p.id = m.shared_with
      WHERE m.id = $1`,
    [matterId]);
  if (!m) return null;
  if (OWNERS.includes(user.role) && m.user_id === user.id) return { matter: m, as: 'owner' };
  if (user.role === 'legal_expert' && m.shared_with && m.shared_with_user === user.id) {
    return { matter: m, as: 'expert' };
  }
  return null;
}

// What the owner sees. Fields are listed one by one. shared_with_user is an account id and
// stays on the server.
function ownerView(m) {
  return {
    id: m.id, title: m.title, status: m.status, next_action: m.next_action, next_due: m.next_due,
    route_id: m.route_id, route_title: m.route_title,
    shared_with: m.shared_with, shared_with_name: m.shared_with_name, shared_at: m.shared_at,
    created_at: m.created_at, updated_at: m.updated_at,
  };
}

// GET /api/matters: my matters, soonest deadline first, closed ones last.
router.get('/', requireAuth(...OWNERS), async (req, res) => {
  const rows = await q(
    `SELECT m.*, r.title AS route_title, p.name AS shared_with_name
       FROM matters m
       LEFT JOIN matter_routes r ON r.id = m.route_id
       LEFT JOIN providers p ON p.id = m.shared_with
      WHERE m.user_id = $1
      ORDER BY (m.status = 'closed'), m.next_due NULLS LAST, m.updated_at DESC`,
    [req.user.id]);
  res.json(rows.map(ownerView));
});

// POST /api/matters: open a matter, optionally from a route.
// If the route has a deadline and the user says when it started, the server works out the due
// date from the checked number of days. The user does not type it and the browser does not
// calculate it.
router.post('/', requireAuth(...OWNERS), async (req, res) => {
  const b = req.body || {};
  let title = clean(b.title);
  let nextAction = clean(b.next_action) || null;
  let nextDue = b.next_due || null;
  let routeId = null;

  if (b.route_id !== undefined && b.route_id !== null) {
    if (!isValidId(b.route_id)) return res.status(400).json({ error: 'route_id must name a matter in the directory' });
    const [route] = await q(
      `SELECT id, title, steps, deadline_days FROM matter_routes WHERE id = $1 AND status = 'published'`,
      [b.route_id]);
    if (!route) return res.status(400).json({ error: 'That matter is not in the directory' });
    routeId = route.id;
    if (!title) title = route.title;
    if (!nextAction) nextAction = route.steps[0] || null;
    if (b.deadline_start) {
      if (!isDateString(b.deadline_start)) return res.status(400).json({ error: 'deadline_start must be a date (YYYY-MM-DD)' });
      if (!route.deadline_days) return res.status(400).json({ error: 'That matter has no deadline to count from' });
      if (b.deadline_start > kigaliToday()) return res.status(400).json({ error: 'That date is in the future' });
      nextDue = addDays(b.deadline_start, route.deadline_days);
    }
  }

  if (!title) return res.status(400).json({ error: 'Give the matter a short title' });
  if (title.length > MAX_TITLE) return res.status(400).json({ error: `Keep the title under ${MAX_TITLE} characters` });
  if (nextAction && nextAction.length > MAX_TEXT) return res.status(400).json({ error: 'That next step is too long' });
  if (nextDue !== null && !isDateString(nextDue)) return res.status(400).json({ error: 'next_due must be a date (YYYY-MM-DD)' });

  const [m] = await q(
    `INSERT INTO matters (user_id, route_id, title, next_action, next_due) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.id, routeId, title, nextAction, nextDue]);
  const reminders = await scheduleReminders(m.id, nextDue);
  res.status(201).json({ ...ownerView(m), reminders });
});

// The share routes come before /:id. requireIntParam answers 404 for a non-numeric id so
// '/shared' and '/share-targets' would never be reached if they came after it.

// GET /api/matters/share-targets: who a matter can be shared with. These are published
// directory entries that have an expert login behind them. The login id is not sent.
router.get('/share-targets', requireAuth(...OWNERS), async (_req, res) => {
  res.json(await q(
    `SELECT id, name, type, location FROM providers
      WHERE status = 'published' AND user_id IS NOT NULL
      ORDER BY name`));
});

// GET /api/matters/shared: the expert's list of matters shared with their entry. It does not
// say who owns each one. The owner can say who they are in a note if they want to.
router.get('/shared', requireAuth('legal_expert'), async (req, res) => {
  res.json(await q(
    `SELECT m.id, m.title, m.status, m.next_action, m.next_due, m.shared_at, m.updated_at,
            r.title AS route_title, p.name AS shared_with_name
       FROM matters m
       JOIN providers p ON p.id = m.shared_with AND p.user_id = $1
       LEFT JOIN matter_routes r ON r.id = m.route_id
      ORDER BY (m.status = 'closed'), m.next_due NULLS LAST, m.updated_at DESC`,
    [req.user.id]));
});

// POST /api/matters/:id/share { provider_id }: owner only. It replaces any earlier share so a
// matter is shared with one place at a time and the owner always knows who can see it.
router.post('/:id/share', requireAuth(...OWNERS), requireIntParam('id'), async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access || access.as !== 'owner') return res.status(404).json({ error: 'Matter not found' });
  const providerId = req.body?.provider_id;
  if (!isValidId(providerId)) return res.status(400).json({ error: 'Choose who to share it with' });
  const [target] = await q(
    `SELECT id, name FROM providers WHERE id = $1 AND status = 'published' AND user_id IS NOT NULL`, [providerId]);
  if (!target) return res.status(400).json({ error: 'That lawyer or office cannot receive shared matters' });
  await q(`UPDATE matters SET shared_with = $1, shared_at = now(), updated_at = now() WHERE id = $2`,
    [target.id, access.matter.id]);
  // A line in the matter's history, so the owner can see when it was shared and with whom.
  await q(`INSERT INTO matter_events (matter_id, author_id, occurred_on, description) VALUES ($1,$2,$3,$4)`,
    [access.matter.id, req.user.id, kigaliToday(), `Shared with ${target.name}`]);
  const full = await loadMatter(access.matter.id, req.user);
  res.json(ownerView(full.matter));
});

// DELETE /api/matters/:id/share: owner only. The expert loses access on their next request,
// because the check reads shared_with each time and there is no copy on their side.
router.delete('/:id/share', requireAuth(...OWNERS), requireIntParam('id'), async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access || access.as !== 'owner') return res.status(404).json({ error: 'Matter not found' });
  if (!access.matter.shared_with) return res.status(400).json({ error: 'This matter is not shared' });
  await q(`UPDATE matters SET shared_with = NULL, shared_at = NULL, updated_at = now() WHERE id = $1`, [access.matter.id]);
  await q(`INSERT INTO matter_events (matter_id, author_id, occurred_on, description) VALUES ($1,$2,$3,$4)`,
    [access.matter.id, req.user.id, kigaliToday(), `Stopped sharing with ${access.matter.shared_with_name}`]);
  const full = await loadMatter(access.matter.id, req.user);
  res.json(ownerView(full.matter));
});

// GET /api/matters/:id: the matter, what has been done on it and its reminders.
router.get('/:id', requireAuth(...OWNERS, 'legal_expert'), requireIntParam('id'), async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access) return res.status(404).json({ error: 'Matter not found' });
  const { matter: m } = access;
  const events = await q(
    `SELECT e.id, e.occurred_on, e.description, e.created_at, (e.author_id = $2) AS author_is_owner,
            CASE WHEN e.author_id = $2 THEN NULL ELSE u.name END AS author_name
       FROM matter_events e JOIN users u ON u.id = e.author_id
      WHERE e.matter_id = $1
      ORDER BY e.occurred_on DESC, e.id DESC`,
    [m.id, m.user_id]);
  // The reminder schedule belongs to the owner alone.
  const reminders = access.as === 'owner'
    ? await q(`SELECT id, due_on, send_on, status, sent_at FROM reminders WHERE matter_id = $1 ORDER BY send_on, id`, [m.id])
    : [];
  const view = ownerView(m);
  if (access.as === 'expert') {
    // The expert sees the matter and its history not who it is shared with or when.
    delete view.shared_with;
    delete view.shared_at;
  }
  res.json({ ...view, viewer: access.as, events, reminders });
});

// PUT /api/matters/:id: owner only. A new due date reschedules the reminders. Closing the
// matter cancels them.
router.put('/:id', requireAuth(...OWNERS), requireIntParam('id'), async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access || access.as !== 'owner') return res.status(404).json({ error: 'Matter not found' });
  const { matter: m } = access;
  const has = (k) => Object.prototype.hasOwnProperty.call(req.body || {}, k);

  const title = has('title') ? clean(req.body.title) : m.title;
  const nextAction = has('next_action') ? (clean(req.body.next_action) || null) : m.next_action;
  const nextDue = has('next_due') ? (req.body.next_due || null) : m.next_due;
  const status = has('status') ? req.body.status : m.status;

  if (!title) return res.status(400).json({ error: 'Give the matter a short title' });
  if (title.length > MAX_TITLE) return res.status(400).json({ error: `Keep the title under ${MAX_TITLE} characters` });
  if (nextAction && nextAction.length > MAX_TEXT) return res.status(400).json({ error: 'That next step is too long' });
  if (nextDue !== null && !isDateString(nextDue)) return res.status(400).json({ error: 'next_due must be a date (YYYY-MM-DD)' });
  if (!['open', 'closed'].includes(status)) return res.status(400).json({ error: 'status must be open or closed' });

  const [updated] = await q(
    `UPDATE matters SET title=$1, next_action=$2, next_due=$3, status=$4, updated_at=now() WHERE id=$5 RETURNING *`,
    [title, nextAction, nextDue, status, m.id]);
  if (nextDue !== m.next_due || status !== m.status) {
    await scheduleReminders(m.id, status === 'open' ? nextDue : null);
  }
  const full = await loadMatter(m.id, req.user);
  res.json(ownerView({ ...full.matter, ...updated }));
});

// POST /api/matters/:id/events: log a step that was taken.
router.post('/:id/events', requireAuth(...OWNERS, 'legal_expert'), requireIntParam('id'), async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access) return res.status(404).json({ error: 'Matter not found' });
  const description = clean(req.body?.description);
  const occurredOn = req.body?.occurred_on || kigaliToday();
  if (!description) return res.status(400).json({ error: 'Say what happened' });
  if (description.length > MAX_TEXT) return res.status(400).json({ error: 'That entry is too long' });
  if (!isDateString(occurredOn)) return res.status(400).json({ error: 'occurred_on must be a date (YYYY-MM-DD)' });
  if (occurredOn > kigaliToday()) return res.status(400).json({ error: 'That date is in the future' });
  const [e] = await q(
    `INSERT INTO matter_events (matter_id, author_id, occurred_on, description) VALUES ($1,$2,$3,$4)
     RETURNING id, occurred_on, description, created_at`,
    [access.matter.id, req.user.id, occurredOn, description]);
  await q('UPDATE matters SET updated_at = now() WHERE id = $1', [access.matter.id]);
  res.status(201).json({ ...e, author_is_owner: access.as === 'owner' });
});

// DELETE /api/matters/:id: owner only. It is the user's record so the user can erase it.
// Its history and reminders go with it.
router.delete('/:id', requireAuth(...OWNERS), requireIntParam('id'), async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access || access.as !== 'owner') return res.status(404).json({ error: 'Matter not found' });
  await q('DELETE FROM matters WHERE id = $1', [access.matter.id]);
  res.status(204).end();
});

export default router;

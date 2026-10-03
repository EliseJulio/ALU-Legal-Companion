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

// The one place that decides who may see a matter. Right now only the owner can.
export async function loadMatter(matterId, user) {
  const [m] = await q(
    `SELECT m.*, r.title AS route_title
       FROM matters m
       LEFT JOIN matter_routes r ON r.id = m.route_id
      WHERE m.id = $1`,
    [matterId]);
  if (!m) return null;
  if (OWNERS.includes(user.role) && m.user_id === user.id) return { matter: m, as: 'owner' };
  return null;
}

// What the owner sees. Fields are listed one by one so nothing extra leaks out.
function ownerView(m) {
  return {
    id: m.id, title: m.title, status: m.status, next_action: m.next_action, next_due: m.next_due,
    route_id: m.route_id, route_title: m.route_title,
    created_at: m.created_at, updated_at: m.updated_at,
  };
}

// GET /api/matters: my matters, soonest deadline first, closed ones last.
router.get('/', requireAuth(...OWNERS), async (req, res) => {
  const rows = await q(
    `SELECT m.*, r.title AS route_title
       FROM matters m
       LEFT JOIN matter_routes r ON r.id = m.route_id
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
  const reminders = await q(
    `SELECT id, due_on, send_on, status, sent_at FROM reminders WHERE matter_id = $1 ORDER BY send_on, id`,
    [m.id]);
  res.json({ ...ownerView(m), viewer: access.as, events, reminders });
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

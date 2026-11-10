// Matter tracking: a person's own record of a legal problem. What they have done,
// what comes next and the deadline, with advisory reminders before it.
//
// Privacy is why this file is stricter than any other. A matter is visible to the person who
// made it and to nobody else. The one exception is a legal expert the person is sharing it with.
// Every read goes through loadMatter below. It returns 404 and never 403 for a matter the caller
// may not see, so the route does not even confirm that the matter exists.
//
// There is no anonymous matter. A lasting record and an untraceable one cannot both be true.
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireIntParam, isValidId } from '../middleware/validate.js';
import { scheduleReminders, isDateString, addDays, kigaliToday } from '../services/reminders.js';
import { removeMatterFiles, documentsEnabled, readDocument, EXTENSION } from '../services/documentStore.js';
import {
  readEventUpload, limitEventUploads, typeOfUpload, addEntryWithFile, Refusal,
} from '../services/eventFiles.js';
import { progressFigures } from '../services/checklists.js';

const router = Router();
const OWNERS = ['student', 'staff'];
const MAX_TITLE = 200;
const MAX_TEXT = 2000;

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

// The one place that decides whether the caller may see a matter.
//   owner   always
//   expert  only while the matter is shared with a directory entry linked to their account
//   anyone else  as if it did not exist
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

// What the owner sees of their own matter. The fields are listed one by one because the row
// also holds internal account ids that stay on the server.
function ownerView(m) {
  return {
    id: m.id, title: m.title, status: m.status, next_action: m.next_action, next_due: m.next_due,
    route_id: m.route_id, route_title: m.route_title,
    shared_with: m.shared_with, shared_with_name: m.shared_with_name, shared_at: m.shared_at,
    created_at: m.created_at, updated_at: m.updated_at,
  };
}

// GET /api/matters: my matters. The soonest deadline comes first and closed matters last.
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

// POST /api/matters: open a matter. It can start from a route.
//
// When the route has a deadline and the person says when it started running (deadline_start),
// the due date is worked out here from the checked number of days. It is not typed by the
// person and not worked out in the browser. The sum that decides when someone loses a right
// stays in one place next to the rows an admin published.
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
  // Read back through loadMatter so the answer has the route title like every other read.
  const full = await loadMatter(m.id, req.user);
  res.status(201).json({ ...ownerView(full.matter), reminders });
});

// ------------------------------------------------------------------ sharing with an expert
//
// These two routes are declared before /:id. That route answers 404 for an id that is not a
// number. Declared after it would swallow the words "shared" and "share-targets".

// GET /api/matters/share-targets: who a matter can be shared with. These are published
// directory entries that have a legal expert account. Without an account nobody can read it.
// The account id itself stays on the server.
router.get('/share-targets', requireAuth(...OWNERS), async (_req, res) => {
  res.json(await q(
    `SELECT id, name, category, type, location FROM providers
      WHERE status = 'published' AND user_id IS NOT NULL
      ORDER BY name`));
});

// GET /api/matters/reminders: the reminders of my open matters that are waiting or already sent.
// Cancelled and missed ones are not shown. The title is shown here because only the owner reads it.
// The email itself never carries it.
router.get('/reminders', requireAuth(...OWNERS), async (req, res) => {
  const since = addDays(kigaliToday(), -14);
  res.json(await q(
    `SELECT r.id, r.matter_id, m.title, r.due_on, r.send_on, r.status, r.sent_at
       FROM reminders r JOIN matters m ON m.id = r.matter_id
      WHERE m.user_id = $1 AND m.status = 'open' AND r.status IN ('pending', 'sent') AND r.due_on >= $2
      ORDER BY r.send_on DESC, r.id DESC
      LIMIT 20`,
    [req.user.id, since]));
});

// GET /api/matters/progress: where the documents of each open matter stand.
// It uses the same rule as the checklist page. The latest file for an item is the one that counts.
// Only required items are counted.
// A matter with no checklist or one being checked again says so and carries no figures.
// It is a statement about files a lawyer checked. It is never a promise that an office will accept them.
router.get('/progress', requireAuth(...OWNERS), async (req, res) => {
  const matters = await q(
    `SELECT id, title, next_due, checklist_id, shared_with FROM matters
      WHERE user_id = $1 AND status = 'open'
      ORDER BY next_due NULLS LAST, updated_at DESC`,
    [req.user.id]);
  if (matters.length === 0) return res.json([]);
  const checklistIds = [...new Set(matters.map((m) => m.checklist_id).filter(Boolean))];
  const checklists = checklistIds.length
    ? await q('SELECT id, title, items, status FROM document_checklists WHERE id = ANY($1::int[])', [checklistIds])
    : [];
  const docs = await q(
    `SELECT matter_id, item_key, review_status FROM matter_documents
      WHERE matter_id = ANY($1::int[]) AND item_key IS NOT NULL ORDER BY id`,
    [matters.map((m) => m.id)]);

  res.json(matters.map((m) => {
    const base = { id: m.id, title: m.title, next_due: m.next_due, shared: Boolean(m.shared_with) };
    const c = checklists.find((x) => x.id === m.checklist_id);
    if (!c) return { ...base, checklist: null };
    if (c.status !== 'published') return { ...base, checklist: { title: c.title, under_review: true } };
    const { needed, counts } = progressFigures(c.items, docs.filter((d) => d.matter_id === m.id));
    return {
      ...base,
      checklist: { title: c.title, under_review: false },
      needed,
      complete: counts.complete,
      awaiting: counts.pending,
      to_fix: counts.needs_fix,
      expired: counts.out_of_date,
      missing: counts.missing,
      ready: needed > 0 && counts.complete === needed,
    };
  }));
});

// GET /api/matters/shared: the expert's list. These are the matters shared with an entry linked
// to their account. The owner is not named. The owner shares the matter and not their identity.
// documents_waiting says how many files wait for the lawyer's check. Without it the lawyer would have
// to open every matter to find out that something new arrived.
router.get('/shared', requireAuth('legal_expert'), async (req, res) => {
  res.json(await q(
    `SELECT m.id, m.title, m.status, m.next_action, m.next_due, m.shared_at, m.updated_at,
            r.title AS route_title, p.name AS shared_with_name,
            (SELECT count(*)::int FROM matter_documents d
              WHERE d.matter_id = m.id AND d.review_status = 'pending') AS documents_waiting
       FROM matters m
       JOIN providers p ON p.id = m.shared_with AND p.user_id = $1
       LEFT JOIN matter_routes r ON r.id = m.route_id
      ORDER BY (m.status = 'closed'), m.next_due NULLS LAST, m.updated_at DESC`,
    [req.user.id]));
});

// POST /api/matters/:id/share { provider_id }: the owner only.
// It replaces any existing share. A matter is shared with one place at a time, so the owner
// always knows who can see it.
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
  // A line in the matter's own history so the owner can see later when it was shared and with whom.
  await q(`INSERT INTO matter_events (matter_id, author_id, occurred_on, description) VALUES ($1,$2,$3,$4)`,
    [access.matter.id, req.user.id, kigaliToday(), `Shared with ${target.name}`]);
  const full = await loadMatter(access.matter.id, req.user);
  res.json(ownerView(full.matter));
});

// DELETE /api/matters/:id/share: the owner only. It ends the expert's access on their very
// next request. loadMatter reads shared_with live and there is no copy on the expert's side.
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

// POST /api/matters/:id/checklist { checklist_id } : the owner follows a published checklist. Then the
// matter shows which documents are still missing. Only a published list can be followed. Changing it or
// stopping it never touches the documents that are already attached.
router.post('/:id/checklist', requireAuth(...OWNERS), requireIntParam('id'), async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access || access.as !== 'owner') return res.status(404).json({ error: 'Matter not found' });
  const checklistId = req.body?.checklist_id;
  if (!isValidId(checklistId)) return res.status(400).json({ error: 'Choose a checklist' });
  const [c] = await q(`SELECT id, title FROM document_checklists WHERE id = $1 AND status = 'published'`, [checklistId]);
  if (!c) return res.status(400).json({ error: 'That checklist is not available' });
  await q('UPDATE matters SET checklist_id = $1, updated_at = now() WHERE id = $2', [c.id, access.matter.id]);
  res.json({ checklist_id: c.id, title: c.title });
});

// DELETE /api/matters/:id/checklist : the owner stops following a checklist. The documents stay.
router.delete('/:id/checklist', requireAuth(...OWNERS), requireIntParam('id'), async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access || access.as !== 'owner') return res.status(404).json({ error: 'Matter not found' });
  await q('UPDATE matters SET checklist_id = NULL, updated_at = now() WHERE id = $1', [access.matter.id]);
  res.json({ checklist_id: null });
});

// GET /api/matters/:id: the matter, what has been done on it and its reminders.
router.get('/:id', requireAuth(...OWNERS, 'legal_expert'), requireIntParam('id'), async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access) return res.status(404).json({ error: 'Matter not found' });
  const { matter: m } = access;
  // author_is_owner is sent and not the author's id or name. The owner needs to tell their own
  // entries from the expert's notes. The expert needs nothing more about the owner than that.
  const events = await q(
    `SELECT e.id, e.occurred_on, e.description, e.created_at, (e.author_id = $2) AS author_is_owner,
            CASE WHEN e.author_id = $2 THEN NULL ELSE u.name END AS author_name,
            CASE WHEN f.id IS NULL THEN NULL
                 ELSE json_build_object('name', f.original_name, 'size_bytes', f.size_bytes, 'mime', f.mime) END AS file
       FROM matter_events e JOIN users u ON u.id = e.author_id
       LEFT JOIN matter_event_files f ON f.event_id = e.id
      WHERE e.matter_id = $1
      ORDER BY e.occurred_on DESC, e.id DESC`,
    [m.id, m.user_id]);
  const reminders = access.as === 'owner'
    ? await q(`SELECT id, due_on, send_on, status, sent_at FROM reminders WHERE matter_id = $1 ORDER BY send_on, id`, [m.id])
    : [];
  const view = ownerView(m);
  if (access.as === 'expert') {
    // The expert sees the matter and its history. The expert does not see who shared it.
    delete view.shared_with;
    delete view.shared_at;
    // One expert never sees the name of another. A new expert sees the existing notes as a legal
    // expert's, not as a named colleague's.
    for (const e of events) e.author_name = null;
  }
  res.json({ ...view, viewer: access.as, events, reminders });
});

// PUT /api/matters/:id: the owner only. A new due date makes new reminders. Closing the
// matter cancels them. Opening it again makes them again.
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

// POST /api/matters/:id/events: log a step taken. The owner can. An expert can while it is shared.
// The owner may also attach one file (multipart/form-data, field "file"). The entry and its file are
// made together or not at all. A lawyer's note never carries a file.
router.post('/:id/events', requireAuth(...OWNERS, 'legal_expert'), requireIntParam('id'), readEventUpload, limitEventUploads, async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access) return res.status(404).json({ error: 'Matter not found' });
  const description = clean(req.body?.description);
  const occurredOn = req.body?.occurred_on || kigaliToday();
  if (!description) return res.status(400).json({ error: 'Say what happened' });
  if (description.length > MAX_TEXT) return res.status(400).json({ error: 'That entry is too long' });
  if (!isDateString(occurredOn)) return res.status(400).json({ error: 'occurred_on must be a date (YYYY-MM-DD)' });
  if (occurredOn > kigaliToday()) return res.status(400).json({ error: 'That date is in the future' });

  if (req.file) {
    if (access.as !== 'owner') return res.status(400).json({ error: 'Only the person who owns the matter can attach a file.' });
    // Before anything is stored. With no key the feature is off and the entry is not made either.
    if (!documentsEnabled()) {
      return res.status(503).json({ error: 'Attaching files is not switched on yet. Please try again later.' });
    }
    const mime = typeOfUpload(req.file);
    if (!mime) return res.status(400).json({ error: 'Attach a PDF, PNG or JPEG file.' });
    try {
      const e = await addEntryWithFile({
        matterId: access.matter.id, userId: req.user.id, occurredOn, description, file: req.file, mime,
      });
      return res.status(201).json({ ...e, author_is_owner: true });
    } catch (err) {
      if (err instanceof Refusal) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  }

  const [e] = await q(
    `INSERT INTO matter_events (matter_id, author_id, occurred_on, description) VALUES ($1,$2,$3,$4)
     RETURNING id, occurred_on, description, created_at`,
    [access.matter.id, req.user.id, occurredOn, description]);
  await q('UPDATE matters SET updated_at = now() WHERE id = $1', [access.matter.id]);
  res.status(201).json({ ...e, author_is_owner: access.as === 'owner' });
});

// GET /api/matters/:id/events/:eventId/file: the decrypted file as a download.
// The access is exactly loadMatter: the owner and the lawyer the matter is shared with right now.
// Anyone else gets a 404 as if there were no such file. That includes an admin.
router.get('/:id/events/:eventId/file', requireAuth(), requireIntParam('id'), requireIntParam('eventId'), async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access) return res.status(404).json({ error: 'File not found' });
  // Found by matter_id too, so an entry from another matter is a miss and not a leak.
  const [row] = await q('SELECT * FROM matter_event_files WHERE event_id = $1 AND matter_id = $2',
    [req.params.eventId, access.matter.id]);
  if (!row) return res.status(404).json({ error: 'File not found' });
  let bytes;
  try {
    bytes = await readDocument(row);
  } catch {
    // Missing or altered. It says nothing about why. That is information for an attacker.
    return res.status(500).json({ error: 'Could not read that file. Please try again.' });
  }
  res.set({
    'Content-Type': row.mime,
    // A plain name. The person's own file name has no place in a header.
    'Content-Disposition': `attachment; filename="record-${row.event_id}.${EXTENSION[row.mime]}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(bytes);
});

// DELETE /api/matters/:id: the owner only. The events and reminders are deleted with it.
router.delete('/:id', requireAuth(...OWNERS), requireIntParam('id'), async (req, res) => {
  const access = await loadMatter(req.params.id, req.user);
  if (!access || access.as !== 'owner') return res.status(404).json({ error: 'Matter not found' });
  // The encrypted files go first. Once the matter row is gone the cascade has removed the rows that say
  // where they are. This is the only place where a matter or its documents are deleted.
  await removeMatterFiles(access.matter.id);
  await q('DELETE FROM matters WHERE id = $1', [access.matter.id]);
  res.status(204).end();
});

export default router;

// Documents attached to a matter. A passport. A sale agreement. A TIN certificate. The things a
// lawyer checks before an application goes in.
//
// ACCESS is exactly the access to the matter. It goes through loadMatter and nothing is added to it.
// The owner can upload and read and replace and delete. The legal expert the matter is shared with
// can list and read and give a verdict while it is shared. Everyone else gets a 404 and never a 403.
// So the route does not confirm that a document exists. Stopping the share ends the expert's access
// on their next request.
//
// There is no anonymous version. A matter needs an account.
import express, { Router } from 'express';
import { q, pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { documentUploadLimiter } from '../middleware/rateLimit.js';
import { requireIntParam, isValidId } from '../middleware/validate.js';
import { kigaliToday } from '../services/reminders.js';
import { itemState, isReady } from '../services/checklists.js';
import { documentChanged, lawyerRespondedOnDocument } from '../services/notify.js';
import { loadMatter } from './matters.js';
import {
  documentsEnabled, detectType, storeDocument, readDocument, removeDocumentFile,
  MAX_BYTES, MAX_PER_MATTER, MIME_TYPES, EXTENSION,
} from '../services/documentStore.js';

// mergeParams because the matter id is in the path this router is mounted on.
const router = Router({ mergeParams: true });
const ROLES = ['student', 'staff', 'legal_expert'];
const MAX_LABEL = 120;
// Across all the matters of one person. A few dozen files is real use. It limits what one account
// can store. Without it the cap for one matter would only mean make more matters.
const MAX_PER_PERSON = 100;

// A refusal decided inside the upload transaction. It carries the status and the message.
class Refusal extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Raw bytes and only for the three types. Any other Content-Type leaves req.body empty and the
// handler refuses it.
const rawFile = express.raw({ type: MIME_TYPES, limit: MAX_BYTES });

// The columns are listed one by one. stored_name, iv, auth_tag and sha256 are how the server finds
// and decrypts the file. None of them is ever sent to a browser.
const VIEW = 'id, label, mime, size_bytes, uploaded_at, item_key, review_status, review_note, reviewed_at';

function view(r) {
  return {
    id: r.id, label: r.label, mime: r.mime, size_bytes: r.size_bytes, uploaded_at: r.uploaded_at,
    item_key: r.item_key,
    review: { status: r.review_status, note: r.review_note, reviewed_at: r.reviewed_at },
  };
}

// The checklist a matter follows. An edit sends a checklist back to draft. A list of documents
// nobody has checked must not be shown as if it were checked. So the caller looks at the status.
async function followedChecklist(matter) {
  if (!matter.checklist_id) return null;
  const [c] = await q('SELECT id, title, items, status FROM document_checklists WHERE id = $1', [matter.checklist_id]);
  return c ?? null;
}

// GET /api/matters/:matterId/documents/checklist : each item of the checklist of the matter with the
// file attached to it and where that file stands. It is declared before /:docId/file.
router.get('/checklist', requireAuth(...ROLES), requireIntParam('matterId'), async (req, res) => {
  const access = await loadMatter(req.params.matterId, req.user);
  if (!access) return res.status(404).json({ error: 'Matter not found' });
  const c = await followedChecklist(access.matter);
  if (!c) return res.json({ checklist: null, items: [], ready: false });
  // While it is being checked again it says so and shows nothing of the list.
  if (c.status !== 'published') {
    return res.json({ checklist: { id: c.id, title: c.title, under_review: true }, items: [], ready: false });
  }
  const docs = await q(`SELECT ${VIEW} FROM matter_documents WHERE matter_id = $1 AND item_key IS NOT NULL ORDER BY id`, [access.matter.id]);
  const items = c.items.map((item) => {
    // The latest file for an item is the one that counts. An older one was replaced.
    const doc = [...docs].reverse().find((d) => d.item_key === item.key) ?? null;
    return { ...item, state: itemState(doc), document: doc ? view(doc) : null };
  });
  res.json({ checklist: { id: c.id, title: c.title, under_review: false }, items, ready: isReady(items) });
});

// GET /api/matters/:matterId/documents : the owner or the expert it is shared with.
router.get('/', requireAuth(...ROLES), requireIntParam('matterId'), async (req, res) => {
  const access = await loadMatter(req.params.matterId, req.user);
  if (!access) return res.status(404).json({ error: 'Matter not found' });
  const rows = await q(`SELECT ${VIEW} FROM matter_documents WHERE matter_id = $1 ORDER BY id`, [access.matter.id]);
  const comments = rows.length
    ? await q(
      `SELECT c.id, c.document_id, c.author_id, c.body, c.created_at, u.name AS author_name
         FROM matter_document_comments c JOIN users u ON u.id = c.author_id
        WHERE c.document_id = ANY($1::int[]) ORDER BY c.id`, [rows.map((r) => r.id)])
    : [];
  // The owner sees which lawyer wrote a comment. They chose to share with that office. A lawyer is
  // never shown another lawyer's name because comments outlive a change of who the matter is shared
  // with. They are told only which ones are their own.
  res.json(rows.map((r) => ({
    ...view(r),
    comments: comments.filter((c) => c.document_id === r.id).map((c) => ({
      id: c.id, body: c.body, created_at: c.created_at,
      author_name: access.as === 'owner' ? c.author_name : null,
      by_you: c.author_id === req.user.id,
    })),
  })));
});

// POST /api/matters/:matterId/documents?label= : the body is the file. The owner only.
router.post('/', requireAuth(...ROLES), requireIntParam('matterId'), documentUploadLimiter, rawFile, async (req, res) => {
  const access = await loadMatter(req.params.matterId, req.user);
  if (!access || access.as !== 'owner') return res.status(404).json({ error: 'Matter not found' });

  // Before anything is read or written. With no key the feature is off and not weaker.
  if (!documentsEnabled()) {
    return res.status(503).json({ error: 'Document uploads are not switched on yet. Please try again later.' });
  }
  if (access.matter.status !== 'open') {
    return res.status(400).json({ error: 'This matter is closed. Reopen it to add documents.' });
  }

  const label = typeof req.query.label === 'string' ? req.query.label.trim() : '';
  if (!label || label.length > MAX_LABEL) {
    return res.status(400).json({ error: `Say what this document is, in under ${MAX_LABEL} characters.` });
  }

  const mime = Buffer.isBuffer(req.body) ? detectType(req.body) : null;
  if (!mime) return res.status(400).json({ error: 'Upload a PDF, PNG or JPEG file.' });

  // replaces=<id> : the new file takes the place of an older one on this matter. It is checked
  // before anything is written. So a bad id or a bad file leaves the original as it was.
  let replaced = null;
  if (req.query.replaces !== undefined) {
    if (!isValidId(req.query.replaces)) return res.status(400).json({ error: 'That document is not on this matter.' });
    [replaced] = await q('SELECT id, stored_name, item_key FROM matter_documents WHERE id = $1 AND matter_id = $2',
      [Number(req.query.replaces), access.matter.id]);
    if (!replaced) return res.status(400).json({ error: 'That document is not on this matter.' });
  }

  // item=<key> : this file answers one item of the checklist of the matter. The key must be on the
  // checklist the matter follows and the checklist must be published. Otherwise it is refused and
  // not stored against nothing. A replacement stays on the item its predecessor answered.
  let itemKey = replaced?.item_key ?? null;
  if (req.query.item !== undefined) {
    const c = await followedChecklist(access.matter);
    const onList = c?.status === 'published' && c.items.some((i) => i.key === req.query.item);
    if (!onList) return res.status(400).json({ error: 'That is not one of the documents on the checklist of this matter.' });
    itemKey = req.query.item;
  }

  const explicitItem = req.query.item !== undefined;
  const stored = await storeDocument(req.body);

  // Is there room, is the swap still valid and the insert are one decision. It is made under a lock
  // on the matter in one transaction. As separate steps a burst of parallel uploads all saw room and
  // all went in. Two parallel replaces of one document both succeeded. The lock is held only for
  // these few statements. The slow work of encrypting and writing the file was done above.
  const client = await pool.connect();
  let row;
  let oldName = null;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [access.matter.id]);

    let inheritedItem = null;
    if (replaced) {
      // The old row goes in the same transaction as the new one arrives. So there is never a moment
      // with neither or with both. If someone replaced it first this one is refused.
      const gone = await client.query(
        'DELETE FROM matter_documents WHERE id = $1 AND matter_id = $2 RETURNING stored_name, item_key',
        [replaced.id, access.matter.id]);
      if (!gone.rows.length) throw new Refusal(409, 'That document was already replaced. Load the page again and try again.');
      oldName = gone.rows[0].stored_name;
      inheritedItem = gone.rows[0].item_key;
    } else {
      const { rows: [{ n }] } = await client.query('SELECT count(*)::int AS n FROM matter_documents WHERE matter_id = $1', [access.matter.id]);
      if (n >= MAX_PER_MATTER) {
        throw new Refusal(400, `A matter can hold up to ${MAX_PER_MATTER} documents. Delete one to add another.`);
      }
      const { rows: [{ total }] } = await client.query(
        'SELECT count(*)::int AS total FROM matter_documents d JOIN matters m ON m.id = d.matter_id WHERE m.user_id = $1',
        [req.user.id]);
      if (total >= MAX_PER_PERSON) {
        throw new Refusal(400, `You can keep up to ${MAX_PER_PERSON} documents in total. Delete some to add more.`);
      }
    }

    ({ rows: [row] } = await client.query(
      `INSERT INTO matter_documents (matter_id, label, stored_name, mime, size_bytes, sha256, iv, auth_tag, item_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${VIEW}`,
      [access.matter.id, label, stored.storedName, mime, req.body.length, stored.sha256, stored.iv, stored.authTag,
       explicitItem ? itemKey : inheritedItem]));
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    await removeDocumentFile(stored.storedName); // never leave an encrypted file that nothing points at
    if (err instanceof Refusal) return res.status(err.status).json({ error: err.message });
    // The unique index. One file for each checklist item. Say what to do and not what the database said.
    if (err?.code === '23505' && /one_per_item/.test(err.constraint ?? '')) {
      return res.status(400).json({ error: 'That item already has a file. Replace it instead of adding another.' });
    }
    throw err;
  } finally {
    client.release();
  }

  // The old file goes only now that the new row is committed. It was a new row and not an update. So
  // a verdict on the old bytes cannot follow the new ones. The check starts again.
  if (oldName) await removeDocumentFile(oldName);
  documentChanged(access.matter.id); // tells the lawyer the matter is shared with, if any
  res.status(201).json(view(row));
});

const VERDICTS = ['complete', 'needs_fix', 'out_of_date'];
const MAX_NOTE = 1000;
// How a verdict reads in the history of the matter. In the words of the owner.
const PHRASE = { complete: 'looks complete', needs_fix: 'needs fixing', out_of_date: 'is out of date' };

// PUT /api/matters/:matterId/documents/:docId/review { status, note } : the legal expert this matter
// is shared with at this moment and nobody else. The owner cannot check their own documents. The point
// is an independent look. Stopping the share ends this on the next request.
router.put('/:docId/review', requireAuth(...ROLES), requireIntParam('matterId'), requireIntParam('docId'), async (req, res) => {
  const access = await loadMatter(req.params.matterId, req.user);
  if (!access || access.as !== 'expert') return res.status(404).json({ error: 'Document not found' });

  const { status } = req.body ?? {};
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!VERDICTS.includes(status)) {
    return res.status(400).json({ error: 'Choose one: complete, needs fixing or out of date.' });
  }
  if (note.length > MAX_NOTE) return res.status(400).json({ error: `Keep the note under ${MAX_NOTE} characters.` });
  // A reader told "needs fixing" with no reason has nothing to act on.
  if (status !== 'complete' && !note) {
    return res.status(400).json({ error: 'Say what is wrong. So the owner knows what to fix.' });
  }

  const [row] = await q(
    `UPDATE matter_documents
        SET review_status = $1, review_note = $2, reviewed_by = $3, reviewed_at = now()
      WHERE id = $4 AND matter_id = $5
      RETURNING ${VIEW}`,
    [status, note || null, req.user.id, req.params.docId, access.matter.id]);
  if (!row) return res.status(404).json({ error: 'Document not found' });

  // A line in the history of the matter written by the lawyer. So the owner sees when and what. It
  // can never pass for the owner's own note because author_is_owner is false for it.
  await q('INSERT INTO matter_events (matter_id, author_id, occurred_on, description) VALUES ($1,$2,$3,$4)',
    [access.matter.id, req.user.id, kigaliToday(), `Checked “${row.label}”: ${PHRASE[status]}`]);
  lawyerRespondedOnDocument(access.matter.id, 'review');
  res.json(view(row));
});

const MAX_COMMENTS_PER_DOCUMENT = 50;

// POST /api/matters/:matterId/documents/:docId/comments { body } : the legal expert this matter is
// shared with at this moment and nobody else. A comment is separate from the verdict. A lawyer can ask
// a question without changing Complete or Needs fixing. It belongs to this file. So a replacement file
// starts with none and stopping the share ends the access on the next request.
router.post('/:docId/comments', requireAuth(...ROLES), requireIntParam('matterId'), requireIntParam('docId'), async (req, res) => {
  const access = await loadMatter(req.params.matterId, req.user);
  if (!access || access.as !== 'expert') return res.status(404).json({ error: 'Document not found' });

  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ error: 'Write a comment first.' });
  if (body.length > MAX_NOTE) return res.status(400).json({ error: `Keep the comment under ${MAX_NOTE} characters.` });

  const [doc] = await q('SELECT id, label FROM matter_documents WHERE id = $1 AND matter_id = $2', [req.params.docId, access.matter.id]);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const [{ n }] = await q('SELECT count(*)::int AS n FROM matter_document_comments WHERE document_id = $1', [doc.id]);
  if (n >= MAX_COMMENTS_PER_DOCUMENT) {
    return res.status(400).json({ error: `This document already has ${MAX_COMMENTS_PER_DOCUMENT} comments.` });
  }

  const [row] = await q(
    `INSERT INTO matter_document_comments (document_id, author_id, body) VALUES ($1,$2,$3)
     RETURNING id, body, created_at`, [doc.id, req.user.id, body]);
  // A line in the history of the matter so the owner notices. The text stays on the document.
  await q('INSERT INTO matter_events (matter_id, author_id, occurred_on, description) VALUES ($1,$2,$3,$4)',
    [access.matter.id, req.user.id, kigaliToday(), `Commented on “${doc.label}”`]);
  lawyerRespondedOnDocument(access.matter.id, 'comment');
  res.status(201).json({ ...row, author_name: null, by_you: true });
});

// GET /api/matters/:matterId/documents/:docId/file : the decrypted bytes as a download.
router.get('/:docId/file', requireAuth(...ROLES), requireIntParam('matterId'), requireIntParam('docId'), async (req, res) => {
  const access = await loadMatter(req.params.matterId, req.user);
  if (!access) return res.status(404).json({ error: 'Document not found' });
  // It is also found by matter_id. A document id from another matter is a miss and not a leak.
  const [row] = await q('SELECT * FROM matter_documents WHERE id = $1 AND matter_id = $2', [req.params.docId, access.matter.id]);
  if (!row) return res.status(404).json({ error: 'Document not found' });

  let bytes;
  try {
    bytes = await readDocument(row);
  } catch {
    // Altered or missing or unreadable. It says nothing about why. That is information for an attacker.
    return res.status(500).json({ error: 'Could not read that document. Please try again or upload it again.' });
  }
  res.set({
    'Content-Type': row.mime,
    // A plain name. The label is the person's own text and has no place in a header.
    'Content-Disposition': `attachment; filename="document-${row.id}.${EXTENSION[row.mime]}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(bytes);
});

// DELETE /api/matters/:matterId/documents/:docId : the owner only.
router.delete('/:docId', requireAuth(...ROLES), requireIntParam('matterId'), requireIntParam('docId'), async (req, res) => {
  const access = await loadMatter(req.params.matterId, req.user);
  if (!access || access.as !== 'owner') return res.status(404).json({ error: 'Document not found' });
  const [row] = await q('DELETE FROM matter_documents WHERE id = $1 AND matter_id = $2 RETURNING stored_name',
    [req.params.docId, access.matter.id]);
  if (!row) return res.status(404).json({ error: 'Document not found' });
  await removeDocumentFile(row.stored_name);
  documentChanged(access.matter.id);
  res.status(204).end();
});

export default router;

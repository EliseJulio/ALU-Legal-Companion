// A file on one entry in the record of a matter ("Add to your record").
//
// It uses the same encrypted store as the checklist documents.
// The same key and the same random names and the same type check on the bytes and the same two caps.
// Nothing here makes a second store.
import multer from 'multer';
import { pool } from '../db.js';
import { documentUploadLimiter } from '../middleware/rateLimit.js';
import {
  detectType, storeDocument, countFiles, lockPerson,
  MAX_EVENT_FILE_BYTES, MAX_PER_MATTER, MAX_PER_PERSON,
} from './documentStore.js';

// A refusal found inside the transaction. It carries the status and the message.
export class Refusal extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const MAX_NAME = 120;
const MB = MAX_EVENT_FILE_BYTES / (1024 * 1024);

// The file is kept in memory. It is at most 5 MB and it is encrypted before it is stored.
const parse = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EVENT_FILE_BYTES, files: 1, fields: 6, fieldSize: 16 * 1024, parts: 8 },
}).single('file');

// Reads multipart/form-data and leaves a JSON call alone. A file that is too big or sent in the
// wrong field is refused here with a message the person can act on.
export function readEventUpload(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  parse(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: `That file is over ${MB} MB. Choose a smaller one.` });
    return res.status(400).json({ error: 'Send one file in the "file" field.' });
  });
}

// Every multipart entry is counted, with or without a file, before the body is read. A JSON entry is
// not counted.
export function limitMultipartUploads(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  return documentUploadLimiter(req, res, next);
}

// The most entries one matter can hold.
export const MAX_ENTRIES = 500;
export const ENTRY_CAP_MESSAGE = 'This matter already has the most entries it can hold.';

async function countEntries(client, matterId) {
  const { rows: [{ n }] } = await client.query(
    'SELECT count(*)::int AS n FROM matter_events WHERE matter_id = $1', [matterId]);
  return n;
}

// The name the person will see again. No folders and no control characters and no quotes and at most 120 long.
// The extension is kept so the file still looks like what it is.
export function cleanFileName(raw, mime) {
  const fallback = { 'application/pdf': 'attachment.pdf', 'image/png': 'attachment.png', 'image/jpeg': 'attachment.jpg' }[mime];
  // The multipart parser reads the file name as Latin-1 and browsers send UTF-8. Put the accents back.
  const asUtf8 = Buffer.from(String(raw ?? ''), 'latin1').toString('utf8');
  let name = (asUtf8.includes('�') ? String(raw ?? '') : asUtf8).normalize('NFC');
  name = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
  if (!name) return fallback;
  if (name.length > MAX_NAME) {
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 && name.length - dot <= 8 ? name.slice(dot) : '';
    name = name.slice(0, MAX_NAME - ext.length) + ext;
  }
  return name;
}

// The type of an uploaded file read from its bytes. It is null when the file is not a PDF or PNG or JPEG.
export const typeOfUpload = (file) => detectType(file.buffer);

// Writes the entry and its file in one transaction. There is never an entry without the file the
// person attached and never a file without its entry. The room check and the insert run under the
// same locks as a checklist upload (the person, then the matter), so a burst cannot get past the cap.
export async function addEntryWithFile({ matterId, userId, occurredOn, description, file, mime }) {
  const stored = await storeDocument(file.buffer);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockPerson(client, userId);
    await client.query('SELECT pg_advisory_xact_lock($1)', [matterId]);
    if (await countEntries(client, matterId) >= MAX_ENTRIES) throw new Refusal(400, ENTRY_CAP_MESSAGE);
    const { inMatter, total } = await countFiles(client, matterId, userId);
    if (inMatter >= MAX_PER_MATTER) {
      throw new Refusal(400, `A matter can hold up to ${MAX_PER_MATTER} files. Delete one to add another.`);
    }
    if (total >= MAX_PER_PERSON) {
      throw new Refusal(400, `You can keep up to ${MAX_PER_PERSON} files in total. Delete some to add more.`);
    }
    const { rows: [e] } = await client.query(
      `INSERT INTO matter_events (matter_id, author_id, occurred_on, description) VALUES ($1,$2,$3,$4)
       RETURNING id, occurred_on, description, created_at`,
      [matterId, userId, occurredOn, description]);
    const name = cleanFileName(file.originalname, mime);
    await client.query(
      `INSERT INTO matter_event_files (matter_id, event_id, stored_name, original_name, mime, size_bytes, sha256, iv, auth_tag, content)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [matterId, e.id, stored.storedName, name, mime, file.buffer.length, stored.sha256, stored.iv, stored.authTag, stored.content]);
    await client.query('UPDATE matters SET updated_at = now() WHERE id = $1', [matterId]);
    await client.query('COMMIT');
    return { ...e, file: { name, size_bytes: file.buffer.length, mime } };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Writes one entry with no file. It takes the same lock as an entry with a file, so the cap on
// entries holds for both kinds at once. The caller says the kind: 'entry' for the owner's own line,
// 'system' for a lawyer's note.
export async function addPlainEntry({ matterId, userId, occurredOn, description, kind = 'entry' }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [matterId]);
    if (await countEntries(client, matterId) >= MAX_ENTRIES) throw new Refusal(400, ENTRY_CAP_MESSAGE);
    const { rows: [e] } = await client.query(
      `INSERT INTO matter_events (matter_id, author_id, occurred_on, description, kind) VALUES ($1,$2,$3,$4,$5)
       RETURNING id, occurred_on, description, created_at`,
      [matterId, userId, occurredOn, description, kind]);
    await client.query('UPDATE matters SET updated_at = now() WHERE id = $1', [matterId]);
    await client.query('COMMIT');
    return e;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

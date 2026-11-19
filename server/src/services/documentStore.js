// Encrypted storage for the documents people attach to a matter.
//
// These are passports, IDs and contracts. Three rules follow from that.
//
// 1. They are encrypted before they are stored with AES-256-GCM. The key lives only in the environment as
//    DOCUMENT_KEY. It is 64 hex characters. A copy of a database backup
//    is then not a copy of anyone's passport.
// 2. It fails closed. With no valid key nothing is stored and the feature says it is off.
//    Storing plain files until the key is set would be worse than having no feature.
// 3. A file is named by 16 random bytes. The label a person gave it is never part of the name.
//    Neither is the name it had on their laptop, which often holds their own name.
//
// The stored name is also bound into the ciphertext as additional authenticated data. So a file
// copied under the name of another document fails to decrypt. It is never served as that document.
import crypto from 'node:crypto';

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PER_MATTER = 25;
// Across all the matters of one person. A few dozen files is real use.
export const MAX_PER_PERSON = 100;
// A file on an entry in the record is smaller than a checklist document.
export const MAX_EVENT_FILE_BYTES = 5 * 1024 * 1024;
export const MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
export const EXTENSION = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };

const STORED_NAME = /^[a-f0-9]{32}$/;

function key() {
  const hex = process.env.DOCUMENT_KEY || '';
  return /^[0-9a-fA-F]{64}$/.test(hex) ? Buffer.from(hex, 'hex') : null;
}

export const documentsEnabled = () => key() !== null;

// The type is read from the bytes of the file. A Content-Type header is only what the sender typed.
export function detectType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}

// Encrypts the file. Nothing is written here. The caller inserts what this returns, `content`
// included, in the same transaction as the row, so a failure leaves nothing behind.
export async function storeDocument(buf) {
  const k = key();
  if (!k) throw new Error('DOCUMENT_KEY is not set');
  const storedName = crypto.randomBytes(16).toString('hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  cipher.setAAD(Buffer.from(storedName));
  const encrypted = Buffer.concat([cipher.update(buf), cipher.final()]);
  return {
    storedName,
    content: encrypted,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
  };
}

// Takes a row with its content column. Throws when the content is empty or was altered or was copied from another document. GCM will
// not give back plain bytes that it cannot check.
export async function readDocument(row) {
  const k = key();
  if (!k) throw new Error('DOCUMENT_KEY is not set');
  if (!STORED_NAME.test(row.stored_name)) throw new Error('bad stored name');
  if (!Buffer.isBuffer(row.content)) throw new Error('no stored content');
  const encrypted = row.content;
  const decipher = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(row.iv, 'hex'));
  decipher.setAAD(Buffer.from(row.stored_name));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'hex'));
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// Takes the lock that makes the count of one person's files safe across all their matters. Always
// take it before the lock on a matter. It is a different key space from the matter lock.
export const lockPerson = (client, userId) => client.query('SELECT pg_advisory_xact_lock(2, $1)', [userId]);

// How many files a matter holds and how many a person holds. Both tables count: a checklist document
// and a file on an entry in the record use the same room. Pass the transaction client so the count
// is read under the lock that the insert is made under.
export async function countFiles(client, matterId, userId) {
  const { rows: [c] } = await client.query(
    `SELECT
       (SELECT count(*)::int FROM matter_documents WHERE matter_id = $1)
       + (SELECT count(*)::int FROM matter_event_files WHERE matter_id = $1) AS in_matter,
       (SELECT count(*)::int FROM matter_documents d JOIN matters m ON m.id = d.matter_id WHERE m.user_id = $2)
       + (SELECT count(*)::int FROM matter_event_files f JOIN matters m ON m.id = f.matter_id WHERE m.user_id = $2) AS in_total`,
    [matterId, userId]);
  return { inMatter: c.in_matter, total: c.in_total };
}

// Encrypted storage for the documents people attach to a matter.
//
// These are passports, IDs and contracts. Three decisions follow from that.
//
// 1. They are encrypted on disk with AES-256-GCM. The key lives only in the environment as
//    DOCUMENT_KEY. It is 64 hex characters. A copy of the uploads folder or of a database backup
//    is then not a copy of anyone's passport.
// 2. It fails closed. With no valid key nothing is stored and the feature says it is off.
//    Storing plain files until the key is set would be worse than having no feature.
// 3. A file is named by 16 random bytes. The label a person gave it is never part of the name.
//    Neither is the name it had on their laptop, which often holds their own name.
//
// The stored name is also bound into the ciphertext as additional authenticated data. So a file
// copied under the name of another document fails to decrypt. It is never served as that document.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { q } from '../db.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PER_MATTER = 25;
export const MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
export const EXTENSION = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };

const STORED_NAME = /^[a-f0-9]{32}$/;

// Read on every call and not at import. A test points these at a temporary folder after the app loads.
const dir = () => process.env.DOCUMENTS_DIR || path.resolve(HERE, '..', '..', 'uploads', 'matter-documents');

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

// Encrypts the file and writes it. Gives back what the row must remember to read it again.
export async function storeDocument(buf) {
  const k = key();
  if (!k) throw new Error('DOCUMENT_KEY is not set');
  const storedName = crypto.randomBytes(16).toString('hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  cipher.setAAD(Buffer.from(storedName));
  const encrypted = Buffer.concat([cipher.update(buf), cipher.final()]);
  await fs.mkdir(dir(), { recursive: true });
  // 'wx' refuses to overwrite. 128 random bits are not expected to collide.
  await fs.writeFile(path.join(dir(), storedName), encrypted, { flag: 'wx' });
  return {
    storedName,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
  };
}

// Throws when the file is missing or was altered or was copied from another document. GCM will
// not give back plain bytes that it cannot check.
export async function readDocument(row) {
  const k = key();
  if (!k) throw new Error('DOCUMENT_KEY is not set');
  if (!STORED_NAME.test(row.stored_name)) throw new Error('bad stored name');
  const encrypted = await fs.readFile(path.join(dir(), row.stored_name));
  const decipher = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(row.iv, 'hex'));
  decipher.setAAD(Buffer.from(row.stored_name));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'hex'));
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export async function removeDocumentFile(storedName) {
  if (!STORED_NAME.test(storedName)) return;
  await fs.rm(path.join(dir(), storedName), { force: true });
}

// Called only when the owner deletes their own matter. Nothing else in the application deletes a
// matter or its documents. Closing it does not. An admin does not. Deactivating the account does
// not. A person's record is theirs to keep or to erase.
export async function removeMatterFiles(matterId) {
  const rows = await q('SELECT stored_name FROM matter_documents WHERE matter_id = $1', [matterId]);
  await Promise.all(rows.map((r) => removeDocumentFile(r.stored_name)));
}

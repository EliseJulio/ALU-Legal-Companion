// The token that lets an anonymous person come back to their own booking or question.
// It is the only key to that record. It holds no personal information.
//
// It has 80 bits of randomness. It is written as 16 characters in four groups, for example
// K7F2-9QMD-31XZ-84HC, so a person can copy it by hand. 128 bits would be 26 characters and
// too long to write down.
//
// Only a hash of the token is stored. If the database leaks the tokens in it cannot be used
// to open anyone's record. The token itself is shown once and cannot be recovered.
import crypto from 'crypto';

// Letters and digits without I, L, O and U. They look like 1, 1, 0 and V.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LENGTH = 16;

export function makeAnonToken() {
  let value = 0n;
  for (const byte of crypto.randomBytes(10)) value = (value << 8n) | BigInt(byte);
  let chars = '';
  for (let i = 0; i < LENGTH; i += 1) {
    chars = ALPHABET[Number(value & 31n)] + chars;
    value >>= 5n;
  }
  return chars.match(/.{4}/g).join('-');
}

// Turns what a person typed into the exact token format. Returns null if it cannot be a token.
// Case, spaces and hyphens do not matter. A typed O is read as 0 and a typed I or L as 1.
export function normalizeAnonToken(input) {
  const cleaned = String(input ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (!/^[0-9A-HJKMNP-TV-Z]{16}$/.test(cleaned)) return null;
  return cleaned.match(/.{4}/g).join('-');
}

// What is stored in the database. SHA-256 is enough because the token is long and random,
// so there is nothing for a slow hash to protect.
export function hashAnonToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

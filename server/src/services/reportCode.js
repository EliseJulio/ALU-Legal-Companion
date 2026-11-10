// The code that lets a person come back to a report they sent without giving a name.
// It looks like LC-4F9K27QX: LC for Legal Companion, then 8 characters.
// Only a hash is stored (hashAnonToken, the same one the anonymous questions use). The code opens
// the status and reply of one report and nothing else. Guessing is slowed by the rate limit on
// POST /api/reports/check.
import crypto from 'crypto';

// Letters and digits without I and L and O and U. They look like 1 and 1 and 0 and V.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LENGTH = 8;

export function makeReportCode() {
  let chars = '';
  for (let i = 0; i < LENGTH; i += 1) chars += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `LC-${chars}`;
}

// Turns what a person typed into the exact code format. It gives null if the text cannot be a code.
// Case and spaces and hyphens do not matter. The LC- at the start may be left out.
export function normalizeReportCode(input) {
  let cleaned = String(input ?? '').toUpperCase().replace(/[\s-]/g, '');
  // The prefix is taken off before L is read as 1. Otherwise the L of LC would change.
  if (cleaned.length === LENGTH + 2 && cleaned.startsWith('LC')) cleaned = cleaned.slice(2);
  cleaned = cleaned.replace(/O/g, '0').replace(/[IL]/g, '1');
  if (!/^[0-9A-HJKMNP-TV-Z]{8}$/.test(cleaned)) return null;
  return `LC-${cleaned}`;
}

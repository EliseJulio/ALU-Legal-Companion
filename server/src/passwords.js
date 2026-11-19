// Password hashing with bcrypt.
import bcrypt from 'bcryptjs';

// How strong the hashing is. A bigger number makes password guessing slower.
// The number is saved inside each hash so old hashes still work if it changes.
export const BCRYPT_ROUNDS = 12;

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);
export const checkPassword = (password, hash) => bcrypt.compare(password, hash);

// bcrypt reads only the first 72 bytes and ignores the rest without a word. A longer password
// would look accepted while the end of it is not kept, so it is refused instead.
export const MAX_PASSWORD_BYTES = 72;
export const PASSWORD_TOO_LONG = 'Password must be at most 72 bytes long. Use fewer characters.';
export const passwordTooLong = (password) => Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES;

// Checks a password when there may be no account. With no hash it checks against a fixed
// hash of the same cost, so an unknown address takes as long as a wrong password.
// The result is false whenever there is no hash.
let dummyHash;
export async function checkPasswordOrDummy(password, hash) {
  if (hash) return checkPassword(password, hash);
  dummyHash ??= hashPassword('not-a-real-password');
  await checkPassword(password, await dummyHash);
  return false;
}

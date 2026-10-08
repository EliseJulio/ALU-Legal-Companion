// Password hashing with bcrypt.
import bcrypt from 'bcryptjs';

// How strong the hashing is. A bigger number makes password guessing slower.
// The number is saved inside each hash so old hashes still work if it changes.
export const BCRYPT_ROUNDS = 12;

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);
export const checkPassword = (password, hash) => bcrypt.compare(password, hash);

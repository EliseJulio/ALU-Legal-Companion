// The token that is the only key to an anonymous question or booking.
import crypto from 'crypto';

// Easy to copy by hand, holds no personal data and has 48 bits of randomness (K7F2-9QMD-31XZ style).
export function makeAnonToken() {
  const raw = crypto.randomBytes(9).toString('hex').toUpperCase().slice(0, 12);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

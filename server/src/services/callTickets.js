// Tickets for calls held inside the platform.
//
// A ticket lets one browser join one room as host (the lawyer) or guest.
// The Worker checks it with the same secret. It holds no name or email.
// The room name comes from the booking number and the secret so it cannot be guessed.
import crypto from 'crypto';

export const TICKET_SECONDS = 4 * 60 * 60;
const MIN_SECRET_LENGTH = 32;
const STUN = { urls: 'stun:stun.cloudflare.com:3478' };
const ROOM = /^[0-9a-f]{32}$/;
const ROLES = new Set(['host', 'guest']);

// Read at call time so a changed setting is seen without a restart.
function secret() {
  const value = (process.env.CALL_TICKET_SECRET ?? '').trim();
  return value.length >= MIN_SECRET_LENGTH ? value : null;
}

// The address of the signaling Worker. Only a secure WebSocket address is accepted.
export function signalUrl() {
  try {
    const url = new URL((process.env.CALL_SIGNAL_URL ?? '').trim());
    return url.protocol === 'wss:' ? url.href.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

export function callConfigured() {
  return Boolean(secret() && signalUrl());
}

export function roomNameFor(bookingId) {
  const key = secret();
  if (!key) throw new Error('Call secret is not set');
  return crypto.createHmac('sha256', key).update(`room:${bookingId}`).digest('hex').slice(0, 32);
}

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (input, key) => crypto.createHmac('sha256', key).update(input).digest('base64url');

export function signTicket({ room, role, audio }) {
  const key = secret();
  if (!key) throw new Error('Call secret is not set');
  if (!ROOM.test(String(room))) throw new Error('Room name is not valid');
  if (!ROLES.has(role)) throw new Error('Role is not valid');
  const iat = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ room, role, audio: audio === true, iat, exp: iat + TICKET_SECONDS })}`;
  return `${body}.${sign(body, key)}`;
}

// Returns the claims of a good ticket or null.
export function verifyTicket(token, now = Date.now()) {
  const key = secret();
  const pieces = typeof token === 'string' ? token.split('.') : [];
  if (!key || pieces.length !== 3) return null;
  const [h, p, s] = pieces;
  try {
    const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256') return null;
    const given = Buffer.from(s, 'base64url');
    const wanted = Buffer.from(sign(`${h}.${p}`, key), 'base64url');
    if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (!ROOM.test(String(claims.room)) || !ROLES.has(claims.role)) return null;
    if (typeof claims.audio !== 'boolean' || !Number.isInteger(claims.exp)) return null;
    return claims.exp * 1000 > now ? claims : null;
  } catch {
    return null;
  }
}

const TURN_KEY_ID = /^[A-Za-z0-9_-]{8,64}$/;
const ICE_ADDRESS = /^(stun|turn|turns):/;
const TURN_TIMEOUT_MS = 3000;

// A relay server from Cloudflare with only the fields a browser needs.
function cleanServer(server) {
  const list = (Array.isArray(server?.urls) ? server.urls : [server?.urls])
    .filter((u) => typeof u === 'string' && ICE_ADDRESS.test(u));
  if (list.length === 0) return null;
  const clean = { urls: list };
  if (typeof server.username === 'string') clean.username = server.username;
  if (typeof server.credential === 'string') clean.credential = server.credential;
  return clean;
}

// The servers a browser uses to find a route to the other person.
// With the relay set up Cloudflare gives credentials that last as long as a ticket.
// On any failure it falls back to STUN only.
export async function iceServers(fetchImpl = fetch) {
  const keyId = (process.env.CALL_TURN_KEY_ID ?? '').trim();
  const apiToken = (process.env.CALL_TURN_API_TOKEN ?? '').trim();
  if (!apiToken || !TURN_KEY_ID.test(keyId)) return [STUN];
  try {
    const res = await fetchImpl(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TICKET_SECONDS }),
      signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.json();
    const servers = (Array.isArray(body?.iceServers) ? body.iceServers : []).map(cleanServer).filter(Boolean);
    return servers.length > 0 ? servers : [STUN];
  } catch (err) {
    console.error('[call] relay credentials not made:', err.name);
    return [STUN];
  }
}

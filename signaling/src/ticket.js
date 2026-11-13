const enc = new TextEncoder();
const ROOM_RE = /^[0-9a-f]{32}$/;

function fromB64url(s) {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('bad base64');
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function parseJson(part) {
  return JSON.parse(new TextDecoder().decode(fromB64url(part)));
}

// Returns the claims of a valid ticket or null.
export async function verifyTicket(token, secret, expectedRoom, nowSeconds = Math.floor(Date.now() / 1000)) {
  try {
    if (typeof token !== 'string' || !secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = parseJson(parts[0]);
    if (!header || header.alg !== 'HS256') return null;
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'HMAC', key, fromB64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`),
    );
    if (!ok) return null;
    const c = parseJson(parts[1]);
    if (!c || typeof c !== 'object') return null;
    if (typeof c.room !== 'string' || !ROOM_RE.test(c.room)) return null;
    if (c.role !== 'host' && c.role !== 'guest') return null;
    if (typeof c.audio !== 'boolean') return null;
    if (!Number.isInteger(c.iat) || !Number.isInteger(c.exp)) return null;
    if (c.exp <= nowSeconds) return null;
    if (c.room !== expectedRoom) return null;
    return { room: c.room, role: c.role, audio: c.audio, iat: c.iat, exp: c.exp };
  } catch {
    return null;
  }
}

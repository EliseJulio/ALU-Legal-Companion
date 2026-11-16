const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const SECRET = 'test-only-secret-value';
export const ROOM = 'a'.repeat(32);

export async function makeTicket(claims = {}, { secret = SECRET, header } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { room: ROOM, role: 'host', audio: false, iat: now, exp: now + 600, ...claims };
  const h = b64url(enc.encode(JSON.stringify(header ?? { alg: 'HS256', typ: 'JWT' })));
  const p = b64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${h}.${p}`)));
  return `${h}.${p}.${b64url(sig)}`;
}

export function unsignedTicket(header, payload) {
  const h = b64url(enc.encode(JSON.stringify(header)));
  const p = b64url(enc.encode(JSON.stringify(payload)));
  return `${h}.${p}.`;
}

export class FakeSocket {
  constructor() {
    this.sent = [];
    this.closed = null;
    this.listeners = {};
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  send(text) {
    this.sent.push(JSON.parse(text));
  }
  close(code) {
    if (this.closed === null) this.closed = code ?? 1005;
  }
  types() {
    return this.sent.map((m) => m.type);
  }
  last() {
    return this.sent[this.sent.length - 1];
  }
}

export function makeState() {
  const calls = { alarms: [], deleted: 0, deleteAll: 0 };
  return {
    calls,
    storage: {
      setAlarm: async (t) => calls.alarms.push(t),
      deleteAlarm: async () => { calls.deleted += 1; },
      deleteAll: async () => { calls.deleteAll += 1; },
    },
  };
}

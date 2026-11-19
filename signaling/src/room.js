import { verifyTicket, ticketSecret } from './ticket.js';

const HELLO_TIMEOUT_MS = 5000;
const MAX_BYTES = 16 * 1024;
// Most sockets one room holds, counting ones that have not said hello.
const MAX_SOCKETS = 6;
const RATE_LIMIT = 200;
const RATE_WINDOW_MS = 10_000;
// How long an admitted guest may drop and return without a new knock.
const GRACE_MS = 5 * 60_000;
// A guest who was told "not now" waits this long before knocking again.
const DENY_COOLDOWN_MS = 10_000;
const encoder = new TextEncoder();

function sendJson(ws, msg) {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // the socket is already gone
  }
}

export class CallRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.slots = { host: null, guest: null };
    this.admitted = false;
    // When the admitted guest's socket dropped without a bye, or null.
    this.guestDroppedAt = null;
    this.now = () => Date.now();
    this.lastDeny = null;
    // A role that must be told to start a session: its socket is new or it was told the peer left.
    this.fresh = { host: false, guest: false };
    // Counts every new peer socket, so a client can tell a new peer from the same one.
    this.gen = 0;
    this.maxExp = 0;
    // Reads what must survive the object being evicted before any socket is handled.
    this.ready = state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get('room');
      if (saved && typeof saved === 'object') {
        this.admitted = saved.admitted === true;
        this.guestDroppedAt = typeof saved.guestDroppedAt === 'number' ? saved.guestDroppedAt : null;
        this.maxExp = typeof saved.maxExp === 'number' ? saved.maxExp : 0;
      }
    });
    this.meta = new WeakMap();
    this.pending = new Set();
    this.sockets = new Set();
  }

  // Accepts the upgrade for the room named in the path.
  async fetch(request) {
    const roomName = new URL(request.url).pathname.split('/').pop();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.attach(server, roomName);
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'Sec-WebSocket-Protocol': 'alu-call.v1' },
    });
  }

  // Starts tracking a socket that is already accepted.
  attach(ws, roomName) {
    if (this.sockets.size >= MAX_SOCKETS) {
      ws.close(4007, 'room full');
      return;
    }
    this.sockets.add(ws);
    const meta = { roomName, role: null, chain: Promise.resolve(), times: [] };
    meta.helloTimer = setTimeout(() => {
      if (!meta.role) ws.close(4001, 'hello timeout');
    }, HELLO_TIMEOUT_MS);
    this.meta.set(ws, meta);
    this.pending.add(ws);
    ws.addEventListener('message', (e) => {
      this.onMessage(ws, e.data);
    });
    ws.addEventListener('close', () => this.onClose(ws));
    ws.addEventListener('error', () => this.onClose(ws));
  }

  // Messages from one socket are handled in order.
  onMessage(ws, data) {
    const meta = this.meta.get(ws);
    if (!meta) return Promise.resolve();
    if (this.overLimit(ws, meta, data)) return Promise.resolve();
    meta.chain = meta.chain.then(() => this.handle(ws, meta, data)).catch(() => {});
    return meta.chain;
  }

  // Closes the socket and returns true when size or rate rules are broken.
  overLimit(ws, meta, data) {
    const size = typeof data === 'string' ? encoder.encode(data).length : data.byteLength;
    if (size > MAX_BYTES) {
      sendJson(ws, { type: 'error', code: 'too_large' });
      ws.close(4004, 'too large');
      return true;
    }
    const now = Date.now();
    meta.times = meta.times.filter((t) => now - t < RATE_WINDOW_MS);
    meta.times.push(now);
    if (meta.times.length > RATE_LIMIT) {
      sendJson(ws, { type: 'error', code: 'rate' });
      ws.close(4005, 'rate');
      return true;
    }
    return false;
  }

  async handle(ws, meta, data) {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return sendJson(ws, { type: 'error', code: 'bad_message' });
    }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      return sendJson(ws, { type: 'error', code: 'bad_message' });
    }
    if (!meta.role) {
      if (msg.type !== 'hello') return sendJson(ws, { type: 'error', code: 'bad_message' });
      return this.hello(ws, meta, msg);
    }
    return this.dispatch(ws, meta, msg);
  }

  dispatch(ws, meta, msg) {
    const err = (code) => sendJson(ws, { type: 'error', code });
    switch (msg.type) {
      case 'ping':
        return sendJson(ws, { type: 'pong' });
      case 'admit':
      case 'deny':
        if (meta.role !== 'host' || !this.slots.guest) return err('bad_message');
        return msg.type === 'admit' ? this.admit() : this.deny();
      case 'signal': {
        const d = msg.data;
        if (!d || typeof d !== 'object' || Array.isArray(d)) return err('bad_message');
        if (!this.admitted || !this.slots.guest) return err('not_admitted');
        return this.send(this.otherRole(meta.role), { type: 'signal', data: d });
      }
      case 'bye':
        // A deliberate leave ends the admission at once.
        if (meta.role && this.slots[meta.role] === ws) {
          this.admitted = false;
          this.guestDroppedAt = null;
          this.save();
        }
        this.leave(ws, meta);
        return ws.close(1000, 'bye');
      default:
        return err('bad_message');
    }
  }

  otherRole(role) {
    return role === 'host' ? 'guest' : 'host';
  }

  send(role, msg) {
    if (this.slots[role]) sendJson(this.slots[role], msg);
  }

  // Saves what a new object must know after an eviction.
  save() {
    const value = { admitted: this.admitted, guestDroppedAt: this.guestDroppedAt, maxExp: this.maxExp };
    Promise.resolve(this.state.storage.put('room', value)).catch(() => {});
  }

  // Tells each side that needs it to start, once both are present and the guest is admitted.
  flushStarts() {
    if (!this.admitted || !this.slots.guest || !this.slots.host) return;
    if (this.fresh.guest) this.send('guest', { type: 'admitted', gen: this.gen });
    if (this.fresh.host) this.send('host', { type: 'start', gen: this.gen });
    this.fresh = { host: false, guest: false };
  }

  // A second admit changes nothing.
  admit() {
    if (this.admitted) return;
    this.admitted = true;
    this.gen += 1;
    this.fresh = { host: true, guest: true };
    this.save();
    this.flushStarts();
  }

  // The guest is told "not now" and may knock again after a short wait.
  deny() {
    const guest = this.slots.guest;
    this.slots.guest = null;
    this.admitted = false;
    this.lastDeny = this.now();
    this.save();
    sendJson(guest, { type: 'denied' });
    guest.close(4003, 'denied');
  }

  // Frees the slot and tells the other side.
  leave(ws, meta) {
    if (!meta.role || this.slots[meta.role] !== ws) return;
    this.slots[meta.role] = null;
    const other = this.otherRole(meta.role);
    if (this.slots[other]) this.fresh[other] = true;
    this.send(other, { type: 'peer-left' });
  }

  async hello(ws, meta, msg) {
    const claims = await verifyTicket(msg.ticket, ticketSecret(this.env), meta.roomName);
    if (!this.sockets.has(ws)) return;
    if (!claims) {
      sendJson(ws, { type: 'error', code: 'bad_ticket' });
      return ws.close(4001, 'bad ticket');
    }
    clearTimeout(meta.helloTimer);
    if (claims.role === 'guest' && this.lastDeny !== null && this.now() - this.lastDeny < DENY_COOLDOWN_MS) {
      sendJson(ws, { type: 'denied' });
      return ws.close(4003, 'denied');
    }
    // The alarm only ever moves later.
    if (claims.exp > this.maxExp) {
      this.maxExp = claims.exp;
      this.save();
      await this.state.storage.setAlarm(claims.exp * 1000);
    }
    if (!this.sockets.has(ws)) return;
    if (claims.role === 'guest') this.settleGuestDrop();
    meta.role = claims.role;
    this.pending.delete(ws);
    const old = this.slots[claims.role];
    this.slots[claims.role] = ws;
    this.fresh[claims.role] = true;
    // A new socket is a new peer for the other side, which must negotiate again.
    this.fresh[this.otherRole(claims.role)] = true;
    this.gen += 1;
    if (old && old !== ws) old.close(4002, 'replaced');
    const other = this.otherRole(claims.role);
    sendJson(ws, { type: 'ready', role: claims.role, audio: claims.audio, peer: !!this.slots[other], admitted: this.admitted });
    if (!this.admitted && this.slots.guest && this.slots.host) this.send('host', { type: 'knock' });
    this.flushStarts();
  }

  // Ends a guest's drop. Back within the grace keeps the admission. Back later clears it.
  settleGuestDrop() {
    const dropped = this.guestDroppedAt;
    this.guestDroppedAt = null;
    if (dropped !== null && this.now() - dropped >= GRACE_MS) this.admitted = false;
    this.save();
  }

  onClose(ws) {
    this.sockets.delete(ws);
    const meta = this.meta.get(ws);
    if (!meta) return;
    clearTimeout(meta.helloTimer);
    this.pending.delete(ws);
    // A socket that was replaced by a takeover is no longer the guest slot, so it does not start a drop.
    if (meta.role === 'guest' && this.slots.guest === ws && this.admitted) {
      this.guestDroppedAt = this.now();
      this.save();
    }
    this.leave(ws, meta);
  }

  // Runs when the latest ticket has expired.
  async alarm() {
    for (const role of ['host', 'guest']) {
      const ws = this.slots[role];
      if (ws) ws.close(4006, 'expired');
      this.slots[role] = null;
    }
    for (const ws of this.pending) ws.close(4006, 'expired');
    this.pending.clear();
    this.admitted = false;
    this.guestDroppedAt = null;
    this.lastDeny = null;
    this.fresh = { host: false, guest: false };
    this.maxExp = 0;
    await this.state.storage.deleteAll();
  }
}

import { verifyTicket } from './ticket.js';

const HELLO_TIMEOUT_MS = 5000;
const MAX_BYTES = 16 * 1024;
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 10_000;
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
    this.denied = false;
    this.maxExp = 0;
    this.meta = new WeakMap();
    this.pending = new Set();
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
        // A deliberate leave ends the admission. A dropped connection keeps it.
        if (meta.role && this.slots[meta.role] === ws) this.admitted = false;
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

  admit() {
    this.admitted = true;
    this.send('guest', { type: 'admitted' });
    this.send('host', { type: 'start' });
  }

  deny() {
    const guest = this.slots.guest;
    this.slots.guest = null;
    this.admitted = false;
    this.denied = true;
    sendJson(guest, { type: 'denied' });
    guest.close(4003, 'denied');
  }

  // Frees the slot and tells the other side.
  leave(ws, meta) {
    if (!meta.role || this.slots[meta.role] !== ws) return;
    this.slots[meta.role] = null;
    this.send(this.otherRole(meta.role), { type: 'peer-left' });
  }

  async hello(ws, meta, msg) {
    const claims = await verifyTicket(msg.ticket, this.env.CALL_TICKET_SECRET, meta.roomName);
    if (!claims) {
      sendJson(ws, { type: 'error', code: 'bad_ticket' });
      return ws.close(4001, 'bad ticket');
    }
    clearTimeout(meta.helloTimer);
    if (claims.role === 'guest' && this.denied) {
      sendJson(ws, { type: 'denied' });
      return ws.close(4003, 'denied');
    }
    meta.role = claims.role;
    this.pending.delete(ws);
    if (claims.exp > this.maxExp) {
      this.maxExp = claims.exp;
      await this.state.storage.setAlarm(claims.exp * 1000);
    }
    const old = this.slots[claims.role];
    this.slots[claims.role] = ws;
    if (old && old !== ws) old.close(4002, 'replaced');
    const other = this.otherRole(claims.role);
    sendJson(ws, { type: 'ready', role: claims.role, audio: claims.audio, peer: !!this.slots[other], admitted: this.admitted });
    if (!this.admitted && this.slots.guest && this.slots.host) this.send('host', { type: 'knock' });
    if (this.admitted && this.slots.guest && this.slots.host) {
      this.send('guest', { type: 'admitted' });
      this.send('host', { type: 'start' });
    }
  }

  onClose(ws) {
    const meta = this.meta.get(ws);
    if (!meta) return;
    clearTimeout(meta.helloTimer);
    this.pending.delete(ws);
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
    this.denied = false;
    this.maxExp = 0;
    await this.state.storage.deleteAll();
  }
}

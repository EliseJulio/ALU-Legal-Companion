import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import worker from '../src/index.js';
import { makeTicket, ROOM, SECRET } from './helpers.js';

const ORIGIN = 'https://example.invalid';
const url = (path) => `https://signal.test${path}`;

// Offers the subprotocols a browser would send.
function upgrade(room, { origin = ORIGIN, protocols } = {}) {
  const headers = { Upgrade: 'websocket' };
  if (origin) headers.Origin = origin;
  if (protocols) headers['Sec-WebSocket-Protocol'] = protocols;
  return SELF.fetch(url(`/room/${room}`), { headers });
}

async function connect(room, claims = {}) {
  const ticket = await makeTicket({ room, ...claims });
  return upgrade(room, { protocols: `alu-call.v1, ${ticket}` });
}

function open(res) {
  const ws = res.webSocket;
  ws.accept();
  const inbox = [];
  const waiters = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    const w = waiters.shift();
    if (w) w(m);
    else inbox.push(m);
  });
  const next = () => new Promise((resolve) => {
    if (inbox.length) resolve(inbox.shift());
    else waiters.push(resolve);
  });
  return { ws, next };
}

// Calls the Worker with a Durable Object namespace that records any use.
function callWorker(room, headers) {
  const touched = [];
  const env = {
    ALLOWED_ORIGINS: ORIGIN,
    CALL_TICKET_SECRET: SECRET,
    CALL_ROOM: {
      idFromName: (n) => { touched.push(n); throw new Error('namespace used'); },
      get: () => { touched.push('get'); throw new Error('namespace used'); },
    },
  };
  const request = new Request(url(`/room/${room}`), { headers: { Upgrade: 'websocket', ...headers } });
  return worker.fetch(request, env).then((res) => ({ res, touched }));
}

describe('worker routing', () => {
  it('answers /health with the JSON status and nothing else', async () => {
    const res = await SELF.fetch(url('/health'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('answers 405 with an Allow header and an empty body to a POST to /health', async () => {
    const res = await SELF.fetch(url('/health'), { method: 'POST' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, HEAD');
    expect(await res.text()).toBe('');
  });

  it('returns 404 for other paths', async () => {
    for (const p of ['/', '/room', '/room/', '/room/short', `/room/${ROOM}/x`, `/room/${'G'.repeat(32)}`, '/other']) {
      const res = await SELF.fetch(url(p));
      expect(res.status, p).toBe(404);
    }
  });

  it('returns 426 for a non-upgrade request to a room', async () => {
    const res = await SELF.fetch(url(`/room/${ROOM}`));
    expect(res.status).toBe(426);
  });

  it('refuses a missing Origin with 403 before the subprotocol check', async () => {
    const res = await upgrade(ROOM, { origin: null });
    expect(res.status).toBe(403);
  });

  it('refuses an unlisted Origin with 403 before the subprotocol check', async () => {
    const res = await upgrade(ROOM, { origin: 'https://evil.invalid' });
    expect(res.status).toBe(403);
  });

  it('sets no cookies', async () => {
    const res = await SELF.fetch(url('/health'));
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});

describe('subprotocol pre-check', () => {
  const good = () => makeTicket({ room: ROOM });

  it('answers 401 with no subprotocol and never touches the namespace', async () => {
    const { res, touched } = await callWorker(ROOM, { Origin: ORIGIN });
    expect(res.status).toBe(401);
    expect(touched).toEqual([]);
  });

  it('answers 401 when the first entry is wrong', async () => {
    const { res, touched } = await callWorker(ROOM, {
      Origin: ORIGIN, 'Sec-WebSocket-Protocol': `other.v1, ${await good()}`,
    });
    expect(res.status).toBe(401);
    expect(touched).toEqual([]);
  });

  it('answers 401 when there are not exactly two entries', async () => {
    const t = await good();
    for (const value of ['alu-call.v1', `alu-call.v1, ${t}, extra`, `${t}, alu-call.v1`]) {
      const { res, touched } = await callWorker(ROOM, { Origin: ORIGIN, 'Sec-WebSocket-Protocol': value });
      expect(res.status, value).toBe(401);
      expect(touched).toEqual([]);
    }
  });

  it('answers 401 for a ticket made for another room', async () => {
    const t = await makeTicket({ room: 'b'.repeat(32) });
    const { res, touched } = await callWorker(ROOM, { Origin: ORIGIN, 'Sec-WebSocket-Protocol': `alu-call.v1, ${t}` });
    expect(res.status).toBe(401);
    expect(touched).toEqual([]);
  });

  it('answers 401 for an expired ticket', async () => {
    const now = Math.floor(Date.now() / 1000);
    const t = await makeTicket({ iat: now - 100, exp: now - 1 });
    const { res, touched } = await callWorker(ROOM, { Origin: ORIGIN, 'Sec-WebSocket-Protocol': `alu-call.v1, ${t}` });
    expect(res.status).toBe(401);
    expect(touched).toEqual([]);
  });

  it('answers 401 for a ticket signed with another secret', async () => {
    const t = await makeTicket({}, { secret: 'some-other-made-up-secret' });
    const { res } = await callWorker(ROOM, { Origin: ORIGIN, 'Sec-WebSocket-Protocol': `alu-call.v1, ${t}` });
    expect(res.status).toBe(401);
  });

  it('upgrades with 101 and selects alu-call.v1 for a good ticket', async () => {
    const res = await connect(ROOM);
    expect(res.status).toBe(101);
    expect(res.headers.get('Sec-WebSocket-Protocol')).toBe('alu-call.v1');
    res.webSocket.accept();
    res.webSocket.close(1000);
  });
});

describe('ticket secret', () => {
  // An environment whose room stub answers 200, so a request that passes the checks is visible.
  function envWith(secret) {
    return {
      ALLOWED_ORIGINS: ORIGIN,
      CALL_TICKET_SECRET: secret,
      CALL_ROOM: {
        idFromName: () => 'id',
        get: () => ({ fetch: async () => new Response('routed', { status: 200 }) }),
      },
    };
  }

  function roomRequest(ticket) {
    return new Request(url(`/room/${ROOM}`), {
      headers: { Upgrade: 'websocket', Origin: ORIGIN, 'Sec-WebSocket-Protocol': `alu-call.v1, ${ticket}` },
    });
  }

  it('trims stray spaces from the secret before checking a ticket', async () => {
    const ticket = await makeTicket({});
    const res = await worker.fetch(roomRequest(ticket), envWith(`  ${SECRET}\n`));
    expect(res.status).toBe(200);
  });

  it('answers 503 with no detail when the secret is missing or short after trimming', async () => {
    const ticket = await makeTicket({});
    for (const weak of [undefined, '', 'x'.repeat(31), `${'x'.repeat(31)}   `]) {
      const res = await worker.fetch(roomRequest(ticket), envWith(weak));
      expect(res.status, String(weak)).toBe(503);
      expect(await res.text()).toBe('service unavailable');
    }
  });
});

describe('worker websocket', () => {
  it('runs hello, knock, admit and signal through the Durable Object', async () => {
    const room = 'd'.repeat(32);
    const host = open(await connect(room, { role: 'host' }));
    host.ws.send(JSON.stringify({ type: 'hello', ticket: await makeTicket({ room, role: 'host' }) }));
    expect(await host.next()).toEqual({ type: 'ready', role: 'host', audio: false, peer: false, admitted: false });

    const guest = open(await connect(room, { role: 'guest', audio: true }));
    guest.ws.send(JSON.stringify({ type: 'hello', ticket: await makeTicket({ room, role: 'guest', audio: true }) }));
    expect(await guest.next()).toEqual({ type: 'ready', role: 'guest', audio: true, peer: true, admitted: false });
    expect(await host.next()).toEqual({ type: 'knock' });

    host.ws.send(JSON.stringify({ type: 'admit' }));
    expect(await guest.next()).toEqual({ type: 'admitted' });
    expect(await host.next()).toEqual({ type: 'start' });

    guest.ws.send(JSON.stringify({ type: 'signal', data: { mode: 'audio' } }));
    expect(await host.next()).toEqual({ type: 'signal', data: { mode: 'audio' } });
    host.ws.close(1000);
    guest.ws.close(1000);
  });

  it('still checks the hello ticket inside the Durable Object', async () => {
    const room = 'e'.repeat(32);
    const c = open(await connect(room));
    c.ws.send(JSON.stringify({ type: 'hello', ticket: await makeTicket({ room: ROOM }) }));
    expect(await c.next()).toEqual({ type: 'error', code: 'bad_ticket' });
  });

  it('keeps rooms apart', async () => {
    const a = 'f'.repeat(32);
    const b = '1'.repeat(32);
    const hostA = open(await connect(a));
    hostA.ws.send(JSON.stringify({ type: 'hello', ticket: await makeTicket({ room: a, role: 'host' }) }));
    await hostA.next();
    const hostB = open(await connect(b));
    hostB.ws.send(JSON.stringify({ type: 'hello', ticket: await makeTicket({ room: b, role: 'host' }) }));
    expect(await hostB.next()).toMatchObject({ type: 'ready', peer: false });
    expect(hostA.ws.readyState).toBe(1);
    hostA.ws.close(1000);
    hostB.ws.close(1000);
  });
});

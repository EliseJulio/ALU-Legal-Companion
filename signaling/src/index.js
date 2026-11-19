import { CallRoom } from './room.js';
import { verifyTicket, ticketSecret, MIN_SECRET_LENGTH } from './ticket.js';

export { CallRoom };

const PROTOCOL = 'alu-call.v1';
const ROOM_PATH = /^\/room\/([0-9a-f]{32})$/;

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

// The offered subprotocols must be the protocol name then a valid ticket for the room.
async function hasValidTicket(request, secret, room) {
  const offered = (request.headers.get('Sec-WebSocket-Protocol') || '').split(',').map((p) => p.trim());
  if (offered.length !== 2 || offered[0] !== PROTOCOL) return false;
  return (await verifyTicket(offered[1], secret, room)) !== null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const match = ROOM_PATH.exec(url.pathname);
    if (!match) return new Response('not found', { status: 404 });

    const secret = ticketSecret(env);
    if (secret.length < MIN_SECRET_LENGTH) {
      return new Response('service unavailable', { status: 503 });
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('upgrade required', { status: 426 });
    }
    const origin = request.headers.get('Origin');
    if (!origin || !allowedOrigins(env).includes(origin)) {
      return new Response('forbidden', { status: 403 });
    }

    if (!(await hasValidTicket(request, secret, match[1]))) {
      return new Response('unauthorized', { status: 401 });
    }

    const stub = env.CALL_ROOM.get(env.CALL_ROOM.idFromName(match[1]));
    return stub.fetch(request);
  },
};

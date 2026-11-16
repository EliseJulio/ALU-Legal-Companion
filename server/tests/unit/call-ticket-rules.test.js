import crypto from 'crypto';
import {
  callConfigured, roomNameFor, signTicket, verifyTicket, TICKET_SECONDS,
} from '../../src/services/callTickets.js';

const saved = {};
const KEYS = ['CALL_TICKET_SECRET', 'CALL_SIGNAL_URL'];

beforeEach(() => {
  KEYS.forEach((k) => { saved[k] = process.env[k]; });
  process.env.CALL_TICKET_SECRET = 'test-secret-for-tickets-only-0123456789';
  process.env.CALL_SIGNAL_URL = 'wss://signal.example.invalid';
});
afterEach(() => {
  KEYS.forEach((k) => { process.env[k] = saved[k] ?? ''; });
});

const part = (jwt, i) => JSON.parse(Buffer.from(jwt.split('.')[i], 'base64url').toString('utf8'));
const room = () => roomNameFor(7);
const ticket = (role = 'guest') => signTicket({ room: room(), role, audio: false });

describe('a call ticket', () => {
  it('lasts four hours', () => {
    const claims = part(ticket(), 1);
    expect(claims.exp - claims.iat).toBe(4 * 60 * 60);
    expect(TICKET_SECONDS).toBe(4 * 60 * 60);
  });

  it('holds no name, email or account, only the room, the role and the audio choice', () => {
    expect(Object.keys(part(ticket(), 1)).sort()).toEqual(['audio', 'exp', 'iat', 'role', 'room']);
  });

  it('is signed with the shared secret the signaling Worker checks it with', () => {
    const [h, p, s] = ticket().split('.');
    const expected = crypto.createHmac('sha256', process.env.CALL_TICKET_SECRET).update(`${h}.${p}`).digest('base64url');
    expect(s).toBe(expected);
  });

  it('is accepted while it is valid', () => {
    expect(verifyTicket(ticket('host'))).toMatchObject({ room: room(), role: 'host' });
  });

  it('is refused after it expires', () => {
    const later = Date.now() + (TICKET_SECONDS + 5) * 1000;
    expect(verifyTicket(ticket(), later)).toBeNull();
  });

  it('is refused when the payload was changed to make the holder the host', () => {
    const [h, , s] = ticket().split('.');
    const forged = Buffer.from(JSON.stringify({ room: room(), role: 'host', audio: false, iat: 1, exp: 9999999999 })).toString('base64url');
    expect(verifyTicket(`${h}.${forged}.${s}`)).toBeNull();
  });

  it('is refused when it was signed with another secret', () => {
    const jwt = ticket();
    process.env.CALL_TICKET_SECRET = 'another-secret-for-tickets-0123456789';
    expect(verifyTicket(jwt)).toBeNull();
  });

  it('is refused when it uses the “none” algorithm', () => {
    const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ room: room(), role: 'host', audio: false, iat: 1, exp: 9999999999 })).toString('base64url');
    expect(verifyTicket(`${h}.${p}.`)).toBeNull();
  });
});

describe('the room and the set-up', () => {
  it('gives each booking its own random-looking room name that cannot be worked out from the number', () => {
    expect(room()).toMatch(/^[0-9a-f]{32}$/);
    expect(roomNameFor(8)).not.toBe(room());
    const before = room();
    process.env.CALL_TICKET_SECRET = 'another-secret-for-tickets-0123456789';
    expect(room()).not.toBe(before);
  });

  it('is off when the secret is short or the address is not wss', () => {
    expect(callConfigured()).toBe(true);
    process.env.CALL_TICKET_SECRET = 'short';
    expect(callConfigured()).toBe(false);
    process.env.CALL_TICKET_SECRET = 'test-secret-for-tickets-only-0123456789';
    process.env.CALL_SIGNAL_URL = 'ws://signal.example.invalid';
    expect(callConfigured()).toBe(false);
  });
});

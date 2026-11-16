import { describe, it, expect } from 'vitest';
import { verifyTicket } from '../src/ticket.js';
import { makeTicket, unsignedTicket, SECRET, ROOM } from './helpers.js';

const now = () => Math.floor(Date.now() / 1000);

describe('verifyTicket', () => {
  it('accepts a good ticket and returns its claims', async () => {
    const t = await makeTicket({ role: 'guest', audio: true });
    const claims = await verifyTicket(t, SECRET, ROOM);
    expect(claims.role).toBe('guest');
    expect(claims.audio).toBe(true);
    expect(claims.room).toBe(ROOM);
  });

  it('rejects a bad signature', async () => {
    const t = await makeTicket({}, { secret: 'another-made-up-secret' });
    expect(await verifyTicket(t, SECRET, ROOM)).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const t = await makeTicket({ role: 'guest' });
    const [h, , s] = t.split('.');
    const forged = btoa(JSON.stringify({ room: ROOM, role: 'host', audio: false, iat: now(), exp: now() + 600 }))
      .replace(/=+$/, '');
    expect(await verifyTicket(`${h}.${forged}.${s}`, SECRET, ROOM)).toBeNull();
  });

  it('rejects alg none', async () => {
    const t = unsignedTicket({ alg: 'none', typ: 'JWT' },
      { room: ROOM, role: 'host', audio: false, iat: now(), exp: now() + 600 });
    expect(await verifyTicket(t, SECRET, ROOM)).toBeNull();
  });

  it('rejects another alg even when signed with the secret', async () => {
    const t = await makeTicket({}, { header: { alg: 'HS512', typ: 'JWT' } });
    expect(await verifyTicket(t, SECRET, ROOM)).toBeNull();
  });

  it('rejects an expired ticket', async () => {
    const t = await makeTicket({ iat: now() - 100, exp: now() - 1 });
    expect(await verifyTicket(t, SECRET, ROOM)).toBeNull();
  });

  it.each([
    ['room missing', { room: undefined }],
    ['room not hex', { room: 'Z'.repeat(32) }],
    ['room uppercase', { room: 'A'.repeat(32) }],
    ['room too short', { room: 'a'.repeat(31) }],
    ['role unknown', { role: 'admin' }],
    ['audio a string', { audio: 'yes' }],
    ['exp a string', { exp: String(now() + 600) }],
    ['iat missing', { iat: undefined }],
  ])('rejects wrong claims: %s', async (_name, claims) => {
    const t = await makeTicket(claims);
    expect(await verifyTicket(t, SECRET, claims.room ?? ROOM)).toBeNull();
  });

  it('rejects a ticket for a different room than the URL', async () => {
    const t = await makeTicket({ room: 'b'.repeat(32) });
    expect(await verifyTicket(t, SECRET, ROOM)).toBeNull();
  });

  it('rejects junk', async () => {
    for (const j of ['', 'a.b', 'a.b.c', '...', null, 5]) {
      expect(await verifyTicket(j, SECRET, ROOM)).toBeNull();
    }
  });
});

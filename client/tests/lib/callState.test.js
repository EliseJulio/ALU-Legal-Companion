import { describe, it, expect } from 'vitest';
import { initialCall, callReducer } from '@/lib/callState';

const run = (start, ...events) => events.reduce(callReducer, start);
const host = initialCall('host');
const guest = initialCall('guest');
const ready = (role, extra) => ({ type: 'ready', role, admitted: false, peer: true, ...extra });

describe('the lawyer’s side of the call', () => {
  it('waits in the lobby until someone knocks, then shows the knock', () => {
    expect(run(host, ready('host', { peer: false })).phase).toBe('lobby');
    expect(run(host, ready('host', { peer: false }), { type: 'knock' }).phase).toBe('knock');
  });

  it('starts the call only after the lawyer admits', () => {
    expect(run(host, ready('host')).phase).toBe('knock');
    expect(run(host, ready('host'), { type: 'start' }).phase).toBe('starting');
  });

  it('goes back to the lobby, and says so, when the guest leaves', () => {
    const live = run(host, ready('host', { admitted: true }), { type: 'connected' });
    const next = callReducer(live, { type: 'peer-left' });
    expect(next).toMatchObject({ phase: 'lobby', peerLeft: true });
  });
});

describe('the guest’s side of the call', () => {
  it('waits to be admitted and does not start the call on its own', () => {
    expect(run(guest, ready('guest')).phase).toBe('waiting');
  });

  it('starts when admitted and is told plainly when refused', () => {
    expect(run(guest, ready('guest'), { type: 'admitted' }).phase).toBe('starting');
    expect(run(guest, ready('guest'), { type: 'denied' }).phase).toBe('denied');
  });

  it('ends with a clear reason when the lawyer ends it for everyone, and keeps that reason', () => {
    const live = run(guest, ready('guest', { admitted: true }), { type: 'connected' });
    const ended = callReducer(live, { type: 'host-ended' });
    expect(ended).toMatchObject({ phase: 'ended', reason: 'host-ended' });
    expect(callReducer(ended, { type: 'peer-left' }).reason).toBe('host-ended');
  });
});

describe('both sides', () => {
  const live = run(guest, ready('guest', { admitted: true }), { type: 'connected' });

  it('keeps the call going when only the link to the room drops', () => {
    expect(callReducer(live, { type: 'socket-lost' })).toMatchObject({ phase: 'live', signalLost: true });
  });

  it('shows the other person’s microphone and camera state', () => {
    expect(callReducer(live, { type: 'peer-state', mic: false, cam: true }).peer).toEqual({ mic: false, cam: true });
  });

  it('fails when the ticket is refused, but not on a harmless message error', () => {
    expect(callReducer(live, { type: 'server-error', code: 'bad_ticket' }).phase).toBe('failed');
    expect(callReducer(live, { type: 'server-error', code: 'bad_message' }).phase).toBe('live');
  });
});

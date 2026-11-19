import { describe, it, expect, vi, afterEach } from 'vitest';
import { CallRoom } from '../src/room.js';
import { FakeSocket, makeState, makeTicket, SECRET, ROOM } from './helpers.js';

const env = { CALL_TICKET_SECRET: SECRET };

function newRoom() {
  const state = makeState();
  return { room: new CallRoom(state, env), state };
}

async function send(room, ws, msg) {
  await room.onMessage(ws, typeof msg === 'string' ? msg : JSON.stringify(msg));
}

async function join(room, role, claims = {}) {
  const ws = new FakeSocket();
  room.attach(ws, ROOM);
  await send(room, ws, { type: 'hello', ticket: await makeTicket({ role, ...claims }) });
  return ws;
}

afterEach(() => vi.useRealTimers());

describe('hello', () => {
  it('answers a good hello with ready', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host', { audio: true });
    expect(host.last()).toEqual({ type: 'ready', role: 'host', audio: true, peer: false, admitted: false });
  });

  it('rejects a bad ticket with bad_ticket and closes 4001', async () => {
    const { room } = newRoom();
    const ws = new FakeSocket();
    room.attach(ws, ROOM);
    await send(room, ws, { type: 'hello', ticket: 'nope' });
    expect(ws.last()).toEqual({ type: 'error', code: 'bad_ticket' });
    expect(ws.closed).toBe(4001);
  });

  it('rejects a ticket made for another room', async () => {
    const { room } = newRoom();
    const ws = new FakeSocket();
    room.attach(ws, ROOM);
    await send(room, ws, { type: 'hello', ticket: await makeTicket({ room: 'c'.repeat(32) }) });
    expect(ws.last().code).toBe('bad_ticket');
  });

  it('closes 4001 when no hello arrives within 5 seconds', () => {
    vi.useFakeTimers();
    const { room } = newRoom();
    const ws = new FakeSocket();
    room.attach(ws, ROOM);
    vi.advanceTimersByTime(4999);
    expect(ws.closed).toBeNull();
    vi.advanceTimersByTime(2);
    expect(ws.closed).toBe(4001);
  });

  it('does not close an authenticated socket at 5 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { room } = newRoom();
    const host = await join(room, 'host');
    vi.advanceTimersByTime(6000);
    expect(host.closed).toBeNull();
  });

  it('refuses other messages before hello', async () => {
    const { room } = newRoom();
    const ws = new FakeSocket();
    room.attach(ws, ROOM);
    await send(room, ws, { type: 'signal', data: { mode: 'audio' } });
    expect(ws.last()).toEqual({ type: 'error', code: 'bad_message' });
  });

  it('refuses a second hello', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await send(room, host, { type: 'hello', ticket: await makeTicket() });
    expect(host.last()).toEqual({ type: 'error', code: 'bad_message' });
  });
});

describe('roles', () => {
  it('tells a joiner whether the peer is present', async () => {
    const { room } = newRoom();
    await join(room, 'host');
    const guest = await join(room, 'guest');
    expect(guest.sent[0]).toEqual({ type: 'ready', role: 'guest', audio: false, peer: true, admitted: false });
  });

  it('replaces an older connection of the same role with 4002', async () => {
    const { room } = newRoom();
    const first = await join(room, 'host');
    const second = await join(room, 'host');
    expect(first.closed).toBe(4002);
    expect(second.closed).toBeNull();
  });

  it('does not tell the guest the peer left when a host is replaced', async () => {
    const { room } = newRoom();
    const first = await join(room, 'host');
    const guest = await join(room, 'guest');
    await join(room, 'host');
    room.onClose(first);
    expect(guest.types()).not.toContain('peer-left');
  });
});

describe('admission', () => {
  it('knocks the host when a guest joins', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await join(room, 'guest');
    expect(host.types()).toContain('knock');
  });

  it('knocks when the host connects after a guest is waiting', async () => {
    const { room } = newRoom();
    await join(room, 'guest');
    const host = await join(room, 'host');
    expect(host.types()).toEqual(['ready', 'knock']);
  });

  it('admit sends admitted to the guest and start to the host', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, host, { type: 'admit' });
    expect(guest.last()).toEqual({ type: 'admitted' });
    expect(host.last()).toEqual({ type: 'start' });
  });

  it('deny sends denied then closes the guest with 4003', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, host, { type: 'deny' });
    expect(guest.last()).toEqual({ type: 'denied' });
    expect(guest.closed).toBe(4003);
    expect(host.types()).not.toContain('peer-left');
  });

  it('a guest cannot admit or deny', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, guest, { type: 'admit' });
    expect(guest.last()).toEqual({ type: 'error', code: 'bad_message' });
    await send(room, guest, { type: 'deny' });
    expect(guest.closed).toBeNull();
    expect(host.types()).not.toContain('start');
  });

  it('refuses guest signal until admitted', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, guest, { type: 'signal', data: { sdp: 'x' } });
    expect(guest.last()).toEqual({ type: 'error', code: 'not_admitted' });
    expect(host.types()).not.toContain('signal');
  });

  it('refuses host signal until a guest is admitted', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, host, { type: 'signal', data: { sdp: 'x' } });
    expect(host.last()).toEqual({ type: 'error', code: 'not_admitted' });
    expect(guest.types()).not.toContain('signal');
  });

  it('relays signals both ways after admission', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, host, { type: 'admit' });
    await send(room, host, { type: 'signal', data: { sdp: 'offer' } });
    await send(room, guest, { type: 'signal', data: { candidate: 'c' } });
    expect(guest.last()).toEqual({ type: 'signal', data: { sdp: 'offer' } });
    expect(host.last()).toEqual({ type: 'signal', data: { candidate: 'c' } });
  });

  it('rejects signal data that is not an object', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await join(room, 'guest');
    await send(room, host, { type: 'admit' });
    for (const data of ['text', 5, null, [1], undefined]) {
      await send(room, host, { type: 'signal', data });
      expect(host.last()).toEqual({ type: 'error', code: 'bad_message' });
    }
  });

  it('keeps an admitted guest admitted when a dropped link comes back within the grace', async () => {
    const { room, clock } = timedRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, host, { type: 'admit' });
    room.onClose(guest);
    const hostBefore = host.sent.length;
    clock.t += 59_999;
    const again = await join(room, 'guest');
    expect(again.types()).toEqual(['ready', 'admitted']);
    expect(host.sent.slice(hostBefore).map((m) => m.type)).toEqual(['start']);
    await send(room, again, { type: 'signal', data: { sdp: 'x' } });
    expect(host.last()).toEqual({ type: 'signal', data: { sdp: 'x' } });
  });

  it('does not keep admission for a guest who was never admitted', async () => {
    const { room, clock } = timedRoom();
    await join(room, 'host');
    const guest = await join(room, 'guest');
    room.onClose(guest);
    clock.t += 1_000;
    const again = await join(room, 'guest');
    await send(room, again, { type: 'signal', data: { sdp: 'x' } });
    expect(again.last()).toEqual({ type: 'error', code: 'not_admitted' });
  });
});

// A clock the test moves by hand, so the 60 second grace needs no waiting.
function timedRoom() {
  const { room } = newRoom();
  const clock = { t: 1_000_000 };
  room.now = () => clock.t;
  return { room, clock };
}

describe('a guest who leaves must knock again', () => {
  async function admittedGuest() {
    const { room, clock } = timedRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, host, { type: 'admit' });
    return { room, clock, host, guest };
  }

  it('is admitted at once when it says hello again 4 minutes 59.999 seconds after a drop', async () => {
    const { room, clock, host, guest } = await admittedGuest();
    room.onClose(guest);
    clock.t += 299_999;
    const hostBefore = host.sent.length;
    const again = await join(room, 'guest');
    expect(again.types()).toEqual(['ready', 'admitted']);
    expect(again.sent[0].admitted).toBe(true);
    expect(host.sent.slice(hostBefore).map((m) => m.type)).toEqual(['start']);
  });

  it('knocks the host and does not admit a guest who says hello 5 minutes after a drop', async () => {
    const { room, clock, host, guest } = await admittedGuest();
    room.onClose(guest);
    clock.t += 300_000;
    const again = await join(room, 'guest');
    expect(again.sent[0]).toEqual({ type: 'ready', role: 'guest', audio: false, peer: true, admitted: false });
    expect(host.last()).toEqual({ type: 'knock' });
    await send(room, again, { type: 'signal', data: { sdp: 'x' } });
    expect(again.last()).toEqual({ type: 'error', code: 'not_admitted' });
  });

  it('knocks a guest who said bye and comes back within a minute', async () => {
    const { room, clock, host, guest } = await admittedGuest();
    await send(room, guest, { type: 'bye' });
    clock.t += 1_000;
    const again = await join(room, 'guest');
    expect(again.sent[0].admitted).toBe(false);
    expect(host.last()).toEqual({ type: 'knock' });
  });

  it('starts the 5 minutes again for each new drop', async () => {
    const { room, clock, host, guest } = await admittedGuest();
    room.onClose(guest);
    clock.t += 200_000;
    const back = await join(room, 'guest');
    room.onClose(back);
    clock.t += 250_000;
    const third = await join(room, 'guest');
    expect(third.types()).toEqual(['ready', 'admitted']);
    expect(host.last()).toEqual({ type: 'start' });
  });

  it('keeps admission for a takeover made long after a drop that was already settled', async () => {
    const { room, clock, host, guest } = await admittedGuest();
    room.onClose(guest);
    clock.t += 30_000;
    await join(room, 'guest');
    clock.t += 10 * 60_000;
    const hostBefore = host.sent.length;
    const again = await join(room, 'guest');
    expect(again.types()).toEqual(['ready', 'admitted']);
    expect(host.sent.slice(hostBefore).map((m) => m.type)).toEqual(['start']);
  });

  it('keeps admission for a takeover, however long the old socket was open', async () => {
    const { room, clock, host } = await admittedGuest();
    clock.t += 10 * 60_000;
    const hostBefore = host.sent.length;
    const again = await join(room, 'guest');
    expect(again.types()).toEqual(['ready', 'admitted']);
    expect(host.sent.slice(hostBefore).map((m) => m.type)).toEqual(['start']);
  });

  it('does not start the grace when a replaced socket closes after the takeover', async () => {
    const { room, clock, guest } = await admittedGuest();
    await join(room, 'guest');
    room.onClose(guest);
    clock.t += 120_000;
    const third = await join(room, 'guest');
    expect(third.types()).toEqual(['ready', 'admitted']);
  });
});

describe('leaving and basics', () => {
  it('tells the other side when a socket closes', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    room.onClose(guest);
    expect(host.last()).toEqual({ type: 'peer-left' });
  });

  it('bye tells the other side and closes the sender', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, host, { type: 'bye' });
    expect(guest.last()).toEqual({ type: 'peer-left' });
    expect(host.closed).toBe(1000);
  });

  it('a guest who says bye must be let in again', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, host, { type: 'admit' });
    await send(room, guest, { type: 'bye' });
    const again = await join(room, 'guest');
    expect(host.last()).toEqual({ type: 'knock' });
    await send(room, again, { type: 'signal', data: { sdp: 'x' } });
    expect(again.last()).toEqual({ type: 'error', code: 'not_admitted' });
  });

  it('a host who says bye ends the admission', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await join(room, 'guest');
    await send(room, host, { type: 'admit' });
    await send(room, host, { type: 'bye' });
    const back = await join(room, 'host');
    expect(back.types()).toEqual(['ready', 'knock']);
  });

  it('a replaced socket that says bye does not end the new admission', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const oldGuest = await join(room, 'guest');
    await send(room, host, { type: 'admit' });
    const newGuest = await join(room, 'guest');
    await send(room, oldGuest, { type: 'bye' });
    await send(room, newGuest, { type: 'signal', data: { sdp: 'x' } });
    expect(host.last()).toEqual({ type: 'signal', data: { sdp: 'x' } });
  });

  it('answers ping with pong', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await send(room, host, { type: 'ping' });
    expect(host.last()).toEqual({ type: 'pong' });
  });

  it('answers invalid JSON and unknown types with bad_message', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await send(room, host, '{not json');
    expect(host.last()).toEqual({ type: 'error', code: 'bad_message' });
    await send(room, host, { type: 'dance' });
    expect(host.last()).toEqual({ type: 'error', code: 'bad_message' });
    await send(room, host, '[1,2]');
    expect(host.last()).toEqual({ type: 'error', code: 'bad_message' });
  });
});

describe('limits', () => {
  it('closes a seventh socket at once with 4007, counting sockets that have not said hello', () => {
    const { room } = newRoom();
    for (let i = 0; i < 6; i += 1) room.attach(new FakeSocket(), ROOM);
    const seventh = new FakeSocket();
    room.attach(seventh, ROOM);
    expect(seventh.closed).toBe(4007);
    expect(seventh.reason).toBe('room full');
  });

  it('closes 4004 for a message over 16 KB', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await send(room, host, JSON.stringify({ type: 'ping', pad: 'x'.repeat(16 * 1024) }));
    expect(host.closed).toBe(4004);
    expect(host.types()).toEqual(['ready', 'error']);
    expect(host.last()).toEqual({ type: 'error', code: 'too_large' });
  });

  it('accepts a message of exactly 16 KB', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const base = JSON.stringify({ type: 'ping', pad: '' });
    await send(room, host, JSON.stringify({ type: 'ping', pad: 'x'.repeat(16 * 1024 - base.length) }));
    expect(host.closed).toBeNull();
    expect(host.last()).toEqual({ type: 'pong' });
  });

  it('counts bytes, not characters', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await send(room, host, JSON.stringify({ type: 'ping', pad: 'é'.repeat(9000) }));
    expect(host.closed).toBe(4004);
  });

  it('allows 200 messages in 10 seconds and stops the 201st with 4005', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const { room } = newRoom();
    const host = await join(room, 'host');
    // The hello is the first of the 200.
    for (let i = 0; i < 199; i += 1) await send(room, host, { type: 'ping' });
    expect(host.closed).toBeNull();
    await send(room, host, { type: 'ping' });
    expect(host.last()).toEqual({ type: 'error', code: 'rate' });
    expect(host.closed).toBe(4005);
  });

  it('lets the count recover after the window passes', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const { room } = newRoom();
    const host = await join(room, 'host');
    for (let i = 0; i < 58; i += 1) await send(room, host, { type: 'ping' });
    vi.setSystemTime(Date.now() + 10_001);
    for (let i = 0; i < 30; i += 1) await send(room, host, { type: 'ping' });
    expect(host.closed).toBeNull();
  });
});

describe('expiry alarm', () => {
  it('sets the alarm to the latest ticket exp', async () => {
    const { room, state } = newRoom();
    const now = Math.floor(Date.now() / 1000);
    await join(room, 'host', { exp: now + 300 });
    await join(room, 'guest', { exp: now + 900 });
    await join(room, 'guest', { exp: now + 600 });
    expect(state.calls.alarms).toEqual([(now + 300) * 1000, (now + 900) * 1000]);
  });

  it('closes every socket with 4006 and clears state when it fires', async () => {
    const { room, state } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, host, { type: 'admit' });
    const waiting = new FakeSocket();
    room.attach(waiting, ROOM);
    await room.alarm();
    expect(host.closed).toBe(4006);
    expect(guest.closed).toBe(4006);
    expect(waiting.closed).toBe(4006);
    expect(state.calls.deleteAll).toBe(1);
    const fresh = await join(room, 'guest');
    await send(room, fresh, { type: 'signal', data: { sdp: 'x' } });
    expect(fresh.last()).toEqual({ type: 'error', code: 'not_admitted' });
    expect(fresh.sent[0].peer).toBe(false);
  });
});

describe('ready admitted flag', () => {
  it('is false before admission and true for a reconnecting admitted guest', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const first = await join(room, 'guest');
    expect(first.sent[0].admitted).toBe(false);
    await send(room, host, { type: 'admit' });
    const again = await join(room, 'guest');
    expect(again.sent[0].admitted).toBe(true);
  });
});

describe('deny sticks', () => {
  it('refuses a denied guest who was admitted and reconnects', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, host, { type: 'admit' });
    await send(room, host, { type: 'deny' });
    const ticket = await makeTicket({ role: 'guest' });
    const again = new FakeSocket();
    room.attach(again, ROOM);
    await send(room, again, { type: 'hello', ticket });
    expect(again.sent).toEqual([{ type: 'denied' }]);
    expect(again.closed).toBe(4003);
    await send(room, again, { type: 'signal', data: { sdp: 'x' } });
    expect(host.types()).not.toContain('signal');
    expect(guest.closed).toBe(4003);
  });

  it('keeps the denial when the object is recreated on the same storage', async () => {
    const { room, state } = newRoom();
    const host = await join(room, 'host');
    await join(room, 'guest');
    await send(room, host, { type: 'deny' });
    const recreated = new CallRoom(state, env);
    await recreated.ready;
    const again = await join(recreated, 'guest');
    expect(again.sent).toEqual([{ type: 'denied' }]);
    expect(again.closed).toBe(4003);
  });

  it('refuses a never admitted guest after a deny and does not knock', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await join(room, 'guest');
    await send(room, host, { type: 'deny' });
    const before = host.sent.length;
    const again = await join(room, 'guest');
    expect(again.sent).toEqual([{ type: 'denied' }]);
    expect(again.closed).toBe(4003);
    expect(host.sent.length).toBe(before);
  });

  it('refuses a host admit after a deny', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await join(room, 'guest');
    await send(room, host, { type: 'deny' });
    await send(room, host, { type: 'admit' });
    expect(host.last()).toEqual({ type: 'error', code: 'bad_message' });
  });

  it('does not refuse the host after a deny', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await join(room, 'guest');
    await send(room, host, { type: 'deny' });
    const host2 = await join(room, 'host');
    expect(host2.sent[0].type).toBe('ready');
    expect(host2.closed).toBeNull();
  });

  it('resets when the alarm fires', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    await join(room, 'guest');
    await send(room, host, { type: 'deny' });
    await room.alarm();
    const guest = await join(room, 'guest');
    expect(guest.sent[0].type).toBe('ready');
    expect(guest.closed).toBeNull();
  });
});

describe('reconnect during an admitted call', () => {
  async function admittedCall() {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    await send(room, host, { type: 'admit' });
    return { room, host, guest };
  }

  it('guest reconnect gives the guest ready then admitted and the host start', async () => {
    const { room, host, guest } = await admittedCall();
    const hostBefore = host.sent.length;
    const again = await join(room, 'guest');
    expect(again.types()).toEqual(['ready', 'admitted']);
    expect(host.sent.slice(hostBefore)).toEqual([{ type: 'start' }]);
    expect(guest.closed).toBe(4002);
  });

  it('host reconnect gives the host ready then start and the guest admitted', async () => {
    const { room, guest } = await admittedCall();
    const guestBefore = guest.sent.length;
    const again = await join(room, 'host');
    expect(again.types()).toEqual(['ready', 'start']);
    expect(guest.sent.slice(guestBefore)).toEqual([{ type: 'admitted' }]);
  });

  it('does not fire when the other side is absent', async () => {
    const { room, host, guest } = await admittedCall();
    room.onClose(host);
    const again = await join(room, 'guest');
    expect(again.types()).toEqual(['ready']);
    expect(guest.closed).toBe(4002);
  });

  it('does not fire for a guest who was never admitted', async () => {
    const { room } = newRoom();
    const host = await join(room, 'host');
    const guest = await join(room, 'guest');
    expect(guest.types()).toEqual(['ready']);
    expect(host.types()).toEqual(['ready', 'knock']);
  });

  it('does not fire on a reconnect after deny', async () => {
    const { room, host } = await admittedCall();
    await send(room, host, { type: 'deny' });
    const before = host.sent.length;
    const again = await join(room, 'guest');
    expect(again.types()).toEqual(['denied']);
    expect(host.sent.length).toBe(before);
  });

  it('first admission still sends admitted and start once', async () => {
    const { host, guest } = await admittedCall();
    expect(guest.types()).toEqual(['ready', 'admitted']);
    expect(host.types().filter((t) => t === 'start')).toHaveLength(1);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { openSignal } from '@/lib/callSignal';

class FakeSocket {
  static last = null;
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.sent = [];
    this.closed = null;
    FakeSocket.last = this;
  }
  send(text) { this.sent.push(JSON.parse(text)); }
  close(code) { this.closed = code ?? 1000; this.onclose?.({ code: this.closed }); }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(value) { this.onmessage?.({ data: typeof value === 'string' ? value : JSON.stringify(value) }); }
  drop(code = 1006) { this.onclose?.({ code }); }
}
FakeSocket.OPEN = 1;

let events;
const start = () => openSignal({
  url: 'wss://signal.example.invalid/room/abc',
  ticket: 'the.ticket.value',
  onMessage: (m) => events.push(['message', m]),
  onClose: (code) => events.push(['close', code]),
  WebSocketImpl: FakeSocket,
});

beforeEach(() => { events = []; });

describe('the link to the signaling Worker', () => {
  it('sends the ticket as a protocol and in hello, and keeps it out of the address', () => {
    start();
    expect(FakeSocket.last.url).not.toContain('the.ticket.value');
    expect(FakeSocket.last.protocols).toEqual(['alu-call.v1', 'the.ticket.value']);
    FakeSocket.last.open();
    expect(FakeSocket.last.sent[0]).toEqual({ type: 'hello', ticket: 'the.ticket.value' });
  });

  it('passes on messages and ignores text that is not a JSON object', () => {
    start();
    FakeSocket.last.open();
    FakeSocket.last.receive({ type: 'ready', role: 'host' });
    FakeSocket.last.receive('not json');
    FakeSocket.last.receive('"a string"');
    expect(events).toEqual([['message', { type: 'ready', role: 'host' }]]);
  });

  it('reports the close code from the room', () => {
    start();
    FakeSocket.last.open();
    FakeSocket.last.drop(4003);
    expect(events).toEqual([['close', 4003]]);
  });

  it('says bye when the person leaves, and does not report that close as a drop', () => {
    const link = start();
    FakeSocket.last.open();
    link.leave();
    expect(FakeSocket.last.sent.at(-1)).toEqual({ type: 'bye' });
    expect(events).toEqual([]);
  });
});

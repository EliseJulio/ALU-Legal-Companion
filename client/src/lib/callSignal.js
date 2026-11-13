// The link to the signaling service for one call.
//
// The ticket goes in the WebSocket protocol so it stays out of the address and the logs.
// It is also sent as the first message. A ping every 20 seconds keeps the link open.

const PROTOCOL = 'alu-call.v1';
const PING_MS = 20000;

export function openSignal({ url, ticket, onMessage, onClose, WebSocketImpl = WebSocket }) {
  const socket = new WebSocketImpl(url, [PROTOCOL, ticket]);
  let timer = null;
  let leaving = false;

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const isOpen = () => socket.readyState === 1;
  const send = (message) => {
    if (!isOpen()) return false;
    socket.send(JSON.stringify(message));
    return true;
  };

  socket.onopen = () => {
    send({ type: 'hello', ticket });
    timer = setInterval(() => send({ type: 'ping' }), PING_MS);
  };
  socket.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message && typeof message === 'object' && typeof message.type === 'string') onMessage(message);
  };
  socket.onclose = (event) => {
    stop();
    if (!leaving) onClose?.(event.code);
  };

  return {
    send,
    isOpen,
    // Tells the other person and closes. The close is not reported back.
    leave() {
      leaving = true;
      send({ type: 'bye' });
      stop();
      socket.close(1000);
    },
  };
}

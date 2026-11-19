// What the call screen is doing, as a small state machine with no side effects.
//
// Phases: connecting, lobby, knock, waiting, starting, live, denied, ended, failed.
// Events are the service messages plus a few local ones.

export function initialCall(role) {
  return {
    role,
    phase: 'connecting',
    reconnecting: false,
    peerAway: false,
    signalLost: false,
    peer: { mic: true, cam: true },
    peerLeft: false,
    reason: null,
    error: null,
  };
}

// Errors that end the call. The other service errors are shown nowhere and change nothing.
const FATAL_CODES = new Set(['bad_ticket', 'too_large', 'rate', 'room_full', 'bad_link']);

function onReady(state, e) {
  const base = { ...state, signalLost: false };
  if (state.phase === 'live') return base;
  if (e.admitted && e.peer) return { ...base, phase: 'starting' };
  if (state.role === 'host') return { ...base, phase: e.peer ? 'knock' : 'lobby', peerLeft: e.peer ? false : state.peerLeft };
  return { ...base, phase: 'waiting' };
}

const STOPPED = new Set(['ended', 'denied', 'failed']);

export function callReducer(state, e) {
  // A failure stays on screen until the person leaves or tries again.
  if (state.phase === 'failed' && e.type !== 'leave') return state;
  switch (e.type) {
    case 'ready':
      return onReady(state, e);
    case 'knock':
      return state.role === 'host' && state.phase !== 'live' && state.phase !== 'starting'
        ? { ...state, phase: 'knock', peerLeft: false } : state;
    case 'admitted':
    case 'start':
      if (STOPPED.has(state.phase)) return state;
      return { ...state, phase: 'starting', peerLeft: false, peerAway: false };
    case 'peer-away':
      return { ...state, peerAway: true };
    case 'peer-back':
      return { ...state, peerAway: false };
    case 'denied':
      return { ...state, phase: 'denied' };
    case 'peer-left':
      if (state.phase === 'ended') return state;
      if (state.role === 'host') return { ...state, phase: 'lobby', reconnecting: false, peerLeft: true };
      return { ...state, phase: 'ended', reason: 'peer-left', peerAway: false };
    case 'host-ended':
      return { ...state, phase: 'ended', reason: 'host-ended' };
    case 'connected':
      return { ...state, phase: 'live', reconnecting: false };
    case 'media-lost':
      return { ...state, reconnecting: true };
    case 'socket-lost':
      return { ...state, signalLost: true };
    case 'peer-state':
      return { ...state, peer: { mic: e.mic !== false, cam: e.cam !== false } };
    case 'leave':
      return { ...state, phase: 'ended', reason: 'left' };
    case 'closed':
      return { ...state, phase: 'ended', reason: e.reason };
    case 'media-error':
      return { ...state, phase: 'failed', error: e.kind };
    case 'server-error':
      return FATAL_CODES.has(e.code) ? { ...state, phase: 'failed', error: e.code } : state;
    default:
      return state;
  }
}

// What the call screen is doing, as a small state machine with no side effects.
//
// Phases: connecting, lobby, knock, waiting, starting, live, denied, ended, failed.
// Events are the service messages plus a few local ones.

export function initialCall(role) {
  return {
    role,
    phase: 'connecting',
    reconnecting: false,
    signalLost: false,
    peer: { mic: true, cam: true },
    reason: null,
    error: null,
  };
}

// Errors from the service that end the call. The others are shown nowhere and change nothing.
const FATAL_CODES = new Set(['bad_ticket', 'too_large', 'rate']);

function onReady(state, e) {
  const base = { ...state, signalLost: false };
  if (state.phase === 'live') return base;
  if (e.admitted && e.peer) return { ...base, phase: 'starting' };
  if (state.role === 'host') return { ...base, phase: e.peer ? 'knock' : 'lobby' };
  return { ...base, phase: 'waiting' };
}

export function callReducer(state, e) {
  switch (e.type) {
    case 'ready':
      return onReady(state, e);
    case 'knock':
      return state.role === 'host' && state.phase !== 'live' && state.phase !== 'starting'
        ? { ...state, phase: 'knock' } : state;
    case 'admitted':
    case 'start':
      return { ...state, phase: 'starting' };
    case 'denied':
      return { ...state, phase: 'denied' };
    case 'peer-left':
      if (state.role === 'host') return { ...state, phase: 'lobby', reconnecting: false };
      return { ...state, phase: 'ended', reason: 'peer-left' };
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

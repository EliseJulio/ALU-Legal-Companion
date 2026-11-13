// One call between a lawyer (host) and a guest, held inside the platform.
//
// The media goes straight between the two browsers. Nothing is recorded or kept.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { callReducer, initialCall } from '@/lib/callState';
import { openSignal } from '@/lib/callSignal';

const RETRY_MS = [1000, 2000, 4000, 8000];
const DROP_GRACE_MS = 4000;

// Close codes the service uses to end a connection for a reason.
const CLOSE_REASONS = { 4002: 'replaced', 4003: 'denied', 4006: 'expired' };

function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

// The microphone and camera. If only the camera fails the call goes on with sound.
async function getMedia(audioOnly) {
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia) throw Object.assign(new Error('No media'), { name: 'NotSupportedError' });
  if (audioOnly) return { stream: await devices.getUserMedia({ audio: true }), noCamera: false };
  try {
    return { stream: await devices.getUserMedia({ audio: true, video: true }), noCamera: false };
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'NotFoundError') {
      return { stream: await devices.getUserMedia({ audio: true }), noCamera: true };
    }
    throw err;
  }
}

// The guest puts its microphone and camera on the lanes that came from the host's offer.
async function attachTracks(c) {
  c.attached = true;
  const jobs = [];
  for (const t of c.pc.getTransceivers()) {
    t.direction = 'sendrecv';
    t.sender.setStreams?.(c.stream);
    if (t.receiver.track.kind === 'audio') {
      jobs.push(t.sender.replaceTrack(c.stream.getAudioTracks()[0] || null));
    } else {
      c.videoSender = t.sender;
      jobs.push(t.sender.replaceTrack(c.video));
    }
  }
  await Promise.all(jobs);
}

function mediaErrorKind(err) {
  if (err?.name === 'NotAllowedError') return 'permission';
  if (err?.name === 'NotFoundError') return 'no-device';
  return 'media';
}

export function useCall({ reply, audioOnly }) {
  const polite = reply.role === 'guest';
  const [state, dispatch] = useReducer(callReducer, reply.role, initialCall);
  const [local, setLocal] = useState(null);
  const [remote, setRemote] = useState(null);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(!audioOnly);
  const [notice, setNotice] = useState(null);
  const ref = useRef(null);
  if (ref.current === null) {
    ref.current = {
      link: null, pc: null, stream: null, video: null, videoSender: null, queue: [], session: 0, tries: 0,
      making: false, ignore: false, gotRemote: false, attached: false, left: false, dropTimer: null, retryTimer: null,
    };
  }
  const c = ref.current;

  const sendSignal = useCallback((data) => c.link?.send({ type: 'signal', data }), [c]);
  const sendPeerState = useCallback(() => {
    const track = c.stream?.getAudioTracks()[0];
    sendSignal({ peerState: { mic: track ? track.enabled : false, cam: Boolean(c.video && c.video.readyState === 'live') } });
  }, [c, sendSignal]);

  const closeMedia = useCallback(() => {
    clearTimeout(c.dropTimer);
    c.pc?.close();
    c.pc = null;
    stopStream(c.stream);
    c.stream = null;
    c.video = null;
    c.videoSender = null;
    c.attached = false;
    c.queue = [];
    c.gotRemote = false;
    c.making = false;
    c.ignore = false;
    setLocal(null);
    setRemote(null);
  }, [c]);

  const handleSignal = useCallback(async (data) => {
    const pc = c.pc;
    if (!pc) { c.queue.push(data); return; }
    try {
      if (data.sdp) {
        const collision = data.sdp.type === 'offer' && (c.making || pc.signalingState !== 'stable');
        c.ignore = !polite && collision;
        if (c.ignore) return;
        await pc.setRemoteDescription(data.sdp);
        c.gotRemote = true;
        if (polite && !c.attached && c.stream) await attachTracks(c);
        if (data.sdp.type === 'offer') {
          await pc.setLocalDescription();
          sendSignal({ sdp: pc.localDescription });
        }
      } else if ('candidate' in data) {
        if (data.candidate) await pc.addIceCandidate(data.candidate);
      } else if (data.peerState) {
        dispatch({ type: 'peer-state', mic: data.peerState.mic, cam: data.peerState.cam });
      }
    } catch (err) {
      // A candidate for an ignored offer is expected to fail. Other errors show in the connection state.
      if (!c.ignore) console.warn('[call] a setup message was not applied:', err?.name);
    }
  }, [c, polite, sendSignal]);

  const startSession = useCallback(async () => {
    const mine = c.session + 1;
    c.session = mine;
    closeMedia();
    let media;
    try {
      media = await getMedia(audioOnly);
    } catch (err) {
      dispatch({ type: 'media-error', kind: mediaErrorKind(err) });
      return;
    }
    if (c.left || mine !== c.session) { stopStream(media.stream); return; }
    setNotice(media.noCamera ? 'no-camera' : null);
    c.stream = media.stream;
    c.video = media.stream.getVideoTracks()[0] || null;
    setLocal(media.stream);
    setMic(true);
    setCam(Boolean(c.video));

    const pc = new RTCPeerConnection({ iceServers: reply.ice_servers });
    c.pc = pc;
    const heard = new MediaStream();
    setRemote(heard);
    // The host makes the lanes for sound and picture. The guest uses the ones in the host's offer.
    if (!polite) {
      const audioTrack = media.stream.getAudioTracks()[0];
      pc.addTransceiver(audioTrack || 'audio', { direction: 'sendrecv', streams: [media.stream] });
      c.videoSender = pc.addTransceiver(c.video || 'video', { direction: 'sendrecv', streams: [media.stream] }).sender;
    }

    pc.ontrack = (e) => { if (!heard.getTracks().includes(e.track)) heard.addTrack(e.track); };
    pc.onicecandidate = (e) => { if (e.candidate) sendSignal({ candidate: e.candidate.toJSON() }); };
    pc.onnegotiationneeded = async () => {
      // The guest waits for the host's offer.
      if (polite && !c.gotRemote) return;
      try {
        c.making = true;
        await pc.setLocalDescription();
        sendSignal({ sdp: pc.localDescription });
      } catch (err) {
        console.warn('[call] an offer was not made:', err?.name);
      } finally {
        c.making = false;
      }
    };
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === 'connected' || s === 'completed') {
        clearTimeout(c.dropTimer);
        dispatch({ type: 'connected' });
        sendPeerState();
      } else if (s === 'disconnected') {
        clearTimeout(c.dropTimer);
        c.dropTimer = setTimeout(() => dispatch({ type: 'media-lost' }), DROP_GRACE_MS);
      } else if (s === 'failed') {
        dispatch({ type: 'media-lost' });
        if (!polite) pc.restartIce();
      }
    };

    for (const queued of c.queue.splice(0)) await handleSignal(queued);
  }, [c, audioOnly, closeMedia, handleSignal, polite, reply.ice_servers, sendPeerState, sendSignal]);

  // The link to the signaling service. A dropped link is retried while the call goes on.
  useEffect(() => {
    c.left = false;
    function connect() {
      c.link = openSignal({
        url: reply.signal_url,
        ticket: reply.ticket,
        onMessage(m) {
          switch (m.type) {
            case 'signal':
              handleSignal(m.data && typeof m.data === 'object' ? m.data : {});
              break;
            case 'ready':
              c.tries = 0;
              dispatch(m);
              break;
            case 'admitted':
            case 'start':
              dispatch(m);
              startSession();
              break;
            case 'peer-left':
            case 'denied':
              closeMedia();
              dispatch(m);
              break;
            case 'error':
              dispatch({ type: 'server-error', code: m.code });
              break;
            case 'knock':
              dispatch(m);
              break;
            default:
          }
        },
        onClose(code) {
          if (c.left) return;
          if (code === 4001) { dispatch({ type: 'server-error', code: 'bad_ticket' }); return; }
          if (CLOSE_REASONS[code]) {
            closeMedia();
            dispatch(code === 4003 ? { type: 'denied' } : { type: 'closed', reason: CLOSE_REASONS[code] });
            return;
          }
          dispatch({ type: 'socket-lost' });
          if (c.tries >= RETRY_MS.length) { closeMedia(); dispatch({ type: 'closed', reason: 'network' }); return; }
          c.retryTimer = setTimeout(connect, RETRY_MS[c.tries]);
          c.tries += 1;
        },
      });
    }
    connect();
    return () => {
      c.left = true;
      clearTimeout(c.retryTimer);
      c.link?.leave();
      closeMedia();
    };
    // The ticket belongs to one join. A new join mounts a new call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const admit = useCallback(() => c.link?.send({ type: 'admit' }), [c]);
  const deny = useCallback(() => {
    c.link?.send({ type: 'deny' });
    dispatch({ type: 'peer-left' });
  }, [c]);

  const toggleMic = useCallback(() => {
    const track = c.stream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMic(track.enabled);
    sendPeerState();
  }, [c, sendPeerState]);

  // Turning the camera off stops it so the light goes out. Turning it on asks for it again.
  const toggleCam = useCallback(async () => {
    if (!c.videoSender || !c.stream) return;
    if (c.video && c.video.readyState === 'live') {
      c.stream.removeTrack(c.video);
      c.video.stop();
      c.video = null;
      await c.videoSender.replaceTrack(null);
      setCam(false);
      sendPeerState();
      return;
    }
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = fresh.getVideoTracks()[0];
      c.video = track;
      c.stream.addTrack(track);
      await c.videoSender.replaceTrack(track);
      setCam(true);
      setNotice(null);
      sendPeerState();
    } catch (err) {
      setNotice(err?.name === 'NotAllowedError' ? 'camera-blocked' : 'no-camera');
    }
  }, [c, sendPeerState]);

  const leave = useCallback(() => {
    c.left = true;
    clearTimeout(c.retryTimer);
    c.link?.leave();
    closeMedia();
    dispatch({ type: 'leave' });
  }, [c, closeMedia]);

  return { state, local, remote, mic, cam, notice, admit, deny, toggleMic, toggleCam, leave };
}

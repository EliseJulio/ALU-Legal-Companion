import { useEffect, useRef } from 'react';
import { useCall } from '@/lib/useCall';
import Icon from '@/components/Icon';
import { BUTTON_PRIMARY, BUTTON_OUTLINE, BUTTON_DESTRUCTIVE, CARD } from '@/lib/ui';

// The call screen. The lawyer admits a guest here. The controls show during the call.

const STATUS = {
  connecting: 'Connecting to the room…',
  lobby: 'You are in the room. A person who joins will ask to be let in.',
  knock: 'Someone is waiting to join.',
  waiting: 'Your lawyer will let you in. Please wait.',
  starting: 'Starting your microphone and camera…',
  live: 'You are in the call.',
};

const ENDED = {
  left: 'You left the call.',
  'peer-left': 'The other person has left the call.',
  replaced: 'You joined this call from another tab or device, so this one ended.',
  expired: 'This call has ended because its time is over.',
  network: 'The connection to the room was lost.',
};

const FAILED = {
  permission: 'Your browser blocked the microphone. Allow it in the address bar and try again.',
  'no-device': 'No microphone was found on this device.',
  media: 'Your microphone could not be started.',
  bad_ticket: 'This call could not be opened. Go back and press Join again.',
  too_large: 'This call could not be opened. Go back and press Join again.',
  rate: 'Too many messages were sent. Go back and press Join again.',
};

const NOTICES = {
  'no-camera': 'Your camera is not available. The call goes on with sound only.',
  'camera-blocked': 'Your browser blocked the camera. Allow it in the address bar to turn it on.',
};

// Puts a media stream on a video element.
function useStream(stream) {
  const el = useRef(null);
  useEffect(() => {
    if (el.current && el.current.srcObject !== stream) el.current.srcObject = stream || null;
  }, [stream]);
  return el;
}

function ControlButton({ on, onLabel, offLabel, iconOn, iconOff, onClick, disabled }) {
  const label = on ? onLabel : offLabel;
  // An off control gets the soft blue tint and a different icon.
  const tint = on ? '' : '!bg-primary-subtle';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${BUTTON_OUTLINE} ${tint} disabled:opacity-60`}>
      <Icon name={on ? iconOn : iconOff} />
      <span>{label}</span>
    </button>
  );
}

export default function CallRoom({ reply, audioOnly, onLeft, onRetry }) {
  const call = useCall({ reply, audioOnly });
  const { state, local, remote, mic, cam, notice } = call;
  const localRef = useStream(local);
  const remoteRef = useStream(remote);
  const isHost = reply.role === 'host';
  const inCall = state.phase === 'live' || state.phase === 'starting';
  const finished = state.phase === 'ended' || state.phase === 'denied' || state.phase === 'failed';

  let status = STATUS[state.phase];
  if (state.phase === 'ended') status = ENDED[state.reason] || ENDED.left;
  if (state.phase === 'failed') status = FAILED[state.error] || FAILED.media;
  if (state.phase === 'denied') status = 'The lawyer could not take your call now. You can book another time.';
  if (state.phase === 'live' && state.reconnecting) status = 'The connection is weak. Trying to reconnect…';
  else if (state.phase === 'live' && state.signalLost) status = 'Reconnecting to the room. The call goes on.';

  const peerVideoOff = state.phase === 'live' && !state.peer.cam;

  return (
    <section className="mt-4" aria-label="Consultation call">
      <p role="status" aria-live="polite" className="max-w-reading text-base font-semibold text-ink">{status}</p>
      {notice && <p className="mt-2 max-w-reading text-sm text-muted-foreground">{NOTICES[notice]}</p>}

      {isHost && state.phase === 'knock' && (
        <div className={`mt-4 max-w-reading ${CARD}`}>
          <p className="font-semibold text-ink">Someone is waiting to join this consultation.</p>
          <p className="mt-1 text-sm text-muted-foreground">You can let them in or ask them to wait. They see no name from you until you admit them.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={call.admit} className={BUTTON_PRIMARY}>Let them in</button>
            <button type="button" onClick={call.deny} className={BUTTON_OUTLINE}>Not now</button>
          </div>
        </div>
      )}

      {inCall && (
        // A fixed height keeps the controls on screen. The picture is cropped to fit.
        <div className="relative mt-4 h-[clamp(240px,calc(100svh-26rem),560px)] w-full overflow-hidden rounded-card bg-inverse text-inverse-foreground">
          <video ref={remoteRef} autoPlay playsInline aria-label="The other person" className={`h-full w-full object-cover ${peerVideoOff ? 'invisible' : ''}`} />
          {peerVideoOff && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <p className="max-w-xs text-base">The other person has turned their camera off.</p>
            </div>
          )}
          {inCall && !state.peer.mic && (
            <p className="absolute left-3 top-3 rounded-control bg-inverse-foreground px-3 py-1 text-xs font-semibold text-inverse">Their microphone is off</p>
          )}
          {local && (
            <video
              ref={localRef}
              autoPlay
              muted
              playsInline
              aria-label="Your camera"
              className={`absolute bottom-3 right-3 w-[28%] min-w-[96px] max-w-[200px] -scale-x-100 rounded-control border border-inverse-foreground bg-inverse object-cover ${cam ? '' : 'invisible'}`}
            />
          )}
        </div>
      )}

      {!finished && (
        <div className="mt-4 flex flex-wrap gap-3">
          {inCall && (
            <>
              <ControlButton on={mic} onLabel="Mute microphone" offLabel="Turn on microphone" iconOn="mic" iconOff="mic_off" onClick={call.toggleMic} />
              <ControlButton on={cam} onLabel="Turn off camera" offLabel="Turn on camera" iconOn="videocam" iconOff="videocam_off" onClick={call.toggleCam} />
            </>
          )}
          <button
            type="button"
            onClick={() => { call.leave(); onLeft?.(); }}
            className={BUTTON_DESTRUCTIVE}
          >
            <Icon name="call_end" />
            <span>Leave the call</span>
          </button>
        </div>
      )}

      {finished && (
        <div className="mt-4 flex flex-wrap gap-3">
          {state.reason !== 'left' && <button type="button" onClick={onRetry} className={BUTTON_PRIMARY}>Join again</button>}
          <button type="button" onClick={() => onLeft?.()} className={BUTTON_OUTLINE}>Back to my appointments</button>
        </div>
      )}
    </section>
  );
}

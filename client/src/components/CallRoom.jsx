import { useEffect, useRef } from 'react';
import { useCall } from '@/lib/useCall';
import { useFullscreen } from '@/lib/useFullscreen';
import Icon from '@/components/Icon';
import ControlButton from '@/components/ControlButton';
import DraggablePreview from '@/components/DraggablePreview';
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
  'peer-left': 'The lawyer left the call.',
  'host-ended': 'The lawyer ended the call.',
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
  'camera-stalled': 'Your camera is not sending a picture. Close other apps or tabs that use it.',
  'flip-failed': 'The other camera could not be opened. The first one is still on.',
};

// Puts a media stream on a video element.
function useStream(stream) {
  const el = useRef(null);
  useEffect(() => {
    if (el.current && el.current.srcObject !== stream) el.current.srcObject = stream || null;
  }, [stream]);
  return el;
}

export default function CallRoom({ reply, audioOnly, startMuted, onLeft, onRetry }) {
  const call = useCall({ reply, audioOnly, startMuted });
  const { state, local, remote, mic, cam, notice, canFlip, facing } = call;
  const localRef = useStream(local);
  const remoteRef = useStream(remote);
  const stageRef = useRef(null);
  const areaRef = useRef(null);
  const fullscreen = useFullscreen(stageRef);
  const isHost = reply.role === 'host';
  const inCall = state.phase === 'live' || state.phase === 'starting';
  const finished = state.phase === 'ended' || state.phase === 'denied' || state.phase === 'failed';

  let status = STATUS[state.phase];
  if (state.phase === 'ended') status = ENDED[state.reason] || ENDED.left;
  if (state.phase === 'failed') status = FAILED[state.error] || FAILED.media;
  if (state.phase === 'denied') status = 'The lawyer could not take your call now. You can book another time.';
  if (isHost && state.phase === 'lobby' && state.peerLeft) status = 'The other person left the call. You are still in the room.';
  if (state.phase === 'live' && state.reconnecting) status = 'The connection is weak. Trying to reconnect…';
  else if (state.phase === 'live' && state.signalLost) status = 'Reconnecting to the room. The call goes on.';

  const peerVideoOff = state.phase === 'live' && !state.peer.cam;

  const leaveButton = (
    <button type="button" onClick={() => { call.leave(); onLeft?.(); }} className={`${BUTTON_DESTRUCTIVE} min-w-touch !bg-surface`}>
      <Icon name="call_end" />
      <span className={inCall ? 'sr-only sm:not-sr-only' : ''}>{isHost && inCall ? 'End call for everyone' : 'Leave the call'}</span>
    </button>
  );

  // The stage fills the page in full screen. Otherwise its height follows the screen height.
  let stageSize = 'relative mt-4 h-[68svh] w-full rounded-card';
  if (fullscreen.pageFill) stageSize = 'fixed inset-0 z-50';
  else if (fullscreen.full) stageSize = 'h-full w-full';

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
        // The picture fills the area on a phone and fits inside on a laptop.
        <div ref={stageRef} className={`flex flex-col overflow-hidden bg-inverse text-inverse-foreground ${stageSize}`}>
          <div ref={areaRef} className="relative min-h-0 flex-1">
            <video ref={remoteRef} autoPlay playsInline aria-label="The other person" className={`h-full w-full object-cover sm:object-contain ${peerVideoOff ? 'invisible' : ''}`} />
            {peerVideoOff && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                <p className="max-w-xs text-base">The other person has turned their camera off.</p>
              </div>
            )}
            {!state.peer.mic && (
              <p className="absolute left-1/2 top-3 -translate-x-1/2 rounded-control bg-inverse-foreground px-3 py-1 text-xs font-semibold text-inverse">Their microphone is off</p>
            )}
            {local && (
              <DraggablePreview areaRef={areaRef}>
                <video ref={localRef} autoPlay muted playsInline className={`h-full w-full object-cover ${facing === 'environment' ? '' : '-scale-x-100'} ${cam ? '' : 'invisible'}`} />
              </DraggablePreview>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap justify-center gap-2 p-2 sm:gap-3 sm:p-3">
            <ControlButton on={mic} onLabel="Mute microphone" offLabel="Turn on microphone" iconOn="mic" iconOff="mic_off" onClick={call.toggleMic} />
            <ControlButton on={cam} onLabel="Turn off camera" offLabel="Turn on camera" iconOn="videocam" iconOff="videocam_off" onClick={call.toggleCam} />
            {canFlip && cam && <ControlButton on onLabel="Flip camera" iconOn="switch_camera" onClick={call.switchCamera} />}
            <ControlButton on={!fullscreen.full} onLabel="Full screen" offLabel="Exit full screen" iconOn="fullscreen" iconOff="fullscreen_exit" onClick={fullscreen.toggle} />
            {leaveButton}
          </div>
        </div>
      )}

      {!finished && !inCall && <div className="mt-4 flex flex-wrap gap-3">{leaveButton}</div>}

      {finished && (
        <div className="mt-4 flex flex-wrap gap-3">
          {state.reason !== 'left' && <button type="button" onClick={onRetry} className={BUTTON_PRIMARY}>Join again</button>}
          <button type="button" onClick={() => onLeft?.()} className={BUTTON_OUTLINE}>Back to my appointments</button>
        </div>
      )}
    </section>
  );
}

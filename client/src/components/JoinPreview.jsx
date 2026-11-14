import { useEffect, useRef, useState } from 'react';
import ControlButton from '@/components/ControlButton';
import { BUTTON_OUTLINE } from '@/lib/ui';

const MESSAGES = {
  'no-camera': 'Your camera is not available. The call will use sound only.',
  blocked: 'Your browser blocked the camera and microphone. Allow them in the address bar and try again.',
  none: 'This device has no camera or microphone to check.',
};

// An optional check of your camera and microphone before you join. It starts only when you ask.
// Nothing is sent anywhere. The choices carry into the call. The check stops when you join.
export default function JoinPreview({ audioOnly, onAudioOnly, startMuted, onStartMuted }) {
  const [stream, setStream] = useState(null);
  const [problem, setProblem] = useState(null);
  const [cam, setCam] = useState(true);
  const [mic, setMic] = useState(true);
  const video = useRef(null);
  const live = useRef(null);

  useEffect(() => {
    if (video.current && video.current.srcObject !== stream) video.current.srcObject = stream;
  }, [stream]);

  useEffect(() => () => live.current?.getTracks().forEach((t) => t.stop()), []);

  async function start() {
    setProblem(null);
    const devices = navigator.mediaDevices;
    if (!devices?.getUserMedia) {
      setProblem('none');
      return;
    }
    let got;
    let noCamera = false;
    try {
      got = await devices.getUserMedia({ audio: true, video: true });
    } catch (err) {
      if (err?.name !== 'NotAllowedError' && err?.name !== 'NotFoundError') {
        setProblem('blocked');
        return;
      }
      try {
        got = await devices.getUserMedia({ audio: true });
        noCamera = true;
      } catch (err2) {
        setProblem(err2?.name === 'NotFoundError' ? 'none' : 'blocked');
        return;
      }
    }
    if (noCamera || audioOnly) got.getVideoTracks().forEach((t) => t.stop());
    got.getAudioTracks().forEach((t) => { t.enabled = !startMuted; });
    live.current = got;
    setStream(got);
    setCam(!noCamera && !audioOnly);
    setMic(!startMuted);
    if (noCamera) {
      setProblem('no-camera');
      onAudioOnly(true);
    }
  }

  async function toggleCam() {
    if (cam) {
      stream.getVideoTracks().forEach((t) => t.stop());
      setCam(false);
      onAudioOnly(true);
      return;
    }
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getVideoTracks().forEach((t) => stream.removeTrack(t));
      stream.addTrack(fresh.getVideoTracks()[0]);
      setCam(true);
      setProblem(null);
      onAudioOnly(false);
    } catch {
      setProblem('no-camera');
    }
  }

  function toggleMic() {
    const tracks = stream.getAudioTracks();
    const next = !tracks[0]?.enabled;
    tracks.forEach((t) => { t.enabled = next; });
    setMic(next);
    onStartMuted(!next);
  }

  if (!stream) {
    return (
      <div className="w-full">
        <button type="button" onClick={start} className={BUTTON_OUTLINE}>Check camera and microphone</button>
        {problem && <p className="mt-2 text-sm text-muted-foreground">{MESSAGES[problem]}</p>}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative aspect-video max-h-[36svh] w-full overflow-hidden rounded-card bg-inverse text-inverse-foreground">
        <video ref={video} autoPlay muted playsInline aria-label="Your camera preview" className={`h-full w-full -scale-x-100 object-cover ${cam ? '' : 'invisible'}`} />
        {!cam && <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm">Your camera is off. The call will use sound only.</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ControlButton on={mic} onLabel="Mute microphone" offLabel="Turn on microphone" iconOn="mic" iconOff="mic_off" onClick={toggleMic} />
        {problem !== 'no-camera' && (
          <ControlButton on={cam} onLabel="Turn off camera" offLabel="Turn on camera" iconOn="videocam" iconOff="videocam_off" onClick={toggleCam} />
        )}
      </div>
      {problem && <p className="mt-2 text-sm text-muted-foreground">{MESSAGES[problem]}</p>}
    </div>
  );
}

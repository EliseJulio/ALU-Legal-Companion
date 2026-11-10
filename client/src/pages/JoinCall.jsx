import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { useOptionalUser } from '@/lib/AuthContext';
import { secureAddress } from '@/lib/url';
import ErrorNotice from '@/components/ErrorNotice';
import Breadcrumb from '@/components/Breadcrumb';
import {
  BUTTON_LG_PRIMARY, BUTTON_DISABLED, BUTTON_OUTLINE, CARD, PAGE_TITLE, FORM_FIELD, RING, CHECKBOX,
} from '@/lib/ui';

// The page a person joins a consultation from. Nothing starts until Join is pressed: no request
// is sent and no call is made. The anonymous booker gives the code here or it arrives in the
// router state from the booking check page. It never goes in the address.

// A daily.co room address, checked before it becomes a frame. The server makes the address
// from the subdomain set in its settings, so only daily.co is accepted.
function dailyFrameAddress(url) {
  const safe = secureAddress(url);
  if (!safe) return null;
  return new URL(safe).hostname.endsWith('.daily.co') ? safe : null;
}

// What the connection looks like, from the browser alone. It sends no request to any site.
function connectionLine() {
  if (typeof navigator === 'undefined') return 'Connection check: not available on this device.';
  if (navigator.onLine === false) return 'Connection check: you appear to be offline.';
  const kind = navigator.connection?.effectiveType;
  if (kind === 'slow-2g' || kind === '2g' || kind === '3g') return 'Connection check: weak. Audio only uses less data.';
  return 'Connection check: good for video.';
}

export default function JoinCall() {
  const { id } = useParams();
  const user = useOptionalUser();
  const location = useLocation();
  const passedCode = typeof location.state?.code === 'string' ? location.state.code : '';

  const [typedCode, setTypedCode] = useState('');
  const [audioOnly, setAudioOnly] = useState(false);
  const [reply, setReply] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

  const code = passedCode || typedCode.trim();
  const isLawyer = user?.role === 'legal_expert';
  const leaveTo = isLawyer ? '/expert/calendar' : user ? '/my-activity' : '/directory/booking-check';
  const frame = reply?.provider === 'daily' ? dailyFrameAddress(reply.url) : null;
  const meet = reply?.provider === 'meet' ? secureAddress(reply.url) : null;

  async function join() {
    if (joining) return;
    setJoining(true);
    setError(null);
    setReply(null);
    try {
      // A signed-in person sends the login. An anonymous booker sends the code in the body only.
      const body = { audio_only: audioOnly };
      if (!user && code) body.anon_token = code;
      setReply(await apiPost(`/bookings/${encodeURIComponent(id)}/join`, body, { anonymous: !user }));
    } catch (err) {
      setError(err);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Join your consultation" />
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Join your consultation</h1>

      <div className={`mt-4 max-w-reading ${CARD}`}>
        <p>The call starts only when you press Join. Nothing is recorded. The room name is random and used once.</p>
      </div>

      {!user && !passedCode && (
        <div className="mt-6 max-w-form">
          <label htmlFor="join-code" className="block text-sm font-semibold">Your booking code</label>
          <input
            id="join-code"
            type="text"
            value={typedCode}
            onChange={(e) => setTypedCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className={`${FORM_FIELD} font-mono`}
          />
        </div>
      )}

      {!reply && (
        <div className="mt-6 max-w-form space-y-4">
          <p className="text-sm text-muted-foreground">{connectionLine()}</p>
          <label className={`flex min-h-touch cursor-pointer items-center gap-3 rounded-control font-semibold text-ink ${RING}`}>
            <input
              type="checkbox"
              role="switch"
              checked={audioOnly}
              onChange={(e) => setAudioOnly(e.target.checked)}
              className={`${CHECKBOX} ${RING}`}
            />
            <span>Audio only (uses less data)</span>
          </label>
          <button
            type="button"
            onClick={join}
            aria-disabled={joining || undefined}
            className={`w-full sm:w-auto ${joining ? BUTTON_DISABLED : BUTTON_LG_PRIMARY}`}
          >
            {joining ? 'Joining…' : 'Join the call'}
          </button>
        </div>
      )}

      {error && <ErrorNotice error={error} className="mt-4 max-w-form" />}

      {/* Always on the page so the result is read out when it arrives. */}
      <div role="status" className="mt-4">
        {reply?.provider === 'none' && (
          <p className="max-w-reading font-semibold text-ink">
            {reply.message || 'No video room has been set up for this appointment yet.'}
          </p>
        )}
        {reply?.provider === 'meet' && meet && (
          <div className={`max-w-reading ${CARD}`}>
            <p className="font-semibold text-ink">We could not start the call here. Join with Google Meet instead.</p>
            <a
              href={meet}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BUTTON_OUTLINE} mt-4`}
            >
              <span>Open Google Meet<span aria-hidden="true">&nbsp;↗</span>{' '}<span className="sr-only">(opens in a new tab)</span></span>
            </a>
          </div>
        )}
        {reply?.provider === 'daily' && !frame && (
          <p className="max-w-reading font-semibold text-ink">The call could not be opened. Try again in a moment.</p>
        )}
      </div>

      {reply?.provider === 'daily' && frame && (
        <section className="mt-4" aria-label="Video consultation">
          <p className="max-w-reading text-sm font-semibold text-ink">
            {isLawyer
              ? 'Students who knock appear in the call window. Admit them there.'
              : 'Your lawyer will let you in. Please wait.'}
          </p>
          <iframe
            src={`${frame}?t=${encodeURIComponent(reply.token)}`}
            title="Video consultation"
            allow="camera; microphone; autoplay; display-capture; fullscreen"
            className="mt-3 h-[min(70vh,640px)] w-full rounded-card border border-border bg-canvas"
          />
        </section>
      )}

      <p className="mt-6 text-sm">
        <Link to={leaveTo} className={`${BUTTON_OUTLINE}`}>Leave the call</Link>
      </p>
    </div>
  );
}

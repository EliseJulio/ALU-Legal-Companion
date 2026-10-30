import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { signInPath } from '@/lib/url';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import TokenDisplay from '@/components/TokenDisplay';
import ErrorNotice from '@/components/ErrorNotice';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import { CheckField } from '@/components/Field';
import { RING, FIELD, BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_DISABLED, BUTTON_TEXT } from '@/lib/ui';

// There are two routes. The anonymous one ignores any login and stores no name. The other
// needs a student or staff login. The choice picks the URL and the flag together so they can
// never disagree.
const ANON_ENDPOINT = '/bookings/anonymous';
const SELF_ENDPOINT = '/bookings';

// The server checks the date too. Checking here saves a round trip and gives a clear message.
function slotProblem(raw) {
  if (!raw) return 'Choose a date and time for the appointment.';
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return 'That date and time could not be read. Use the picker.';
  if (when.getTime() <= Date.now()) return 'Choose a time in the future.';
  return null;
}

export default function BookProvider() {
  const { id } = useParams();
  const { user } = useAuth();
  const here = useLocation();
  const navigate = useNavigate();
  const [slot, setSlot] = useState('');
  const [topic, setTopic] = useState('');
  // Starts as null on purpose. Nothing is pre-selected. A student in a hurry must not send
  // under their own name a request they meant to keep anonymous.
  const [choice, setChoice] = useState(null);
  const [anonToken, setAnonToken] = useState(null);
  const [bookedAsSelf, setBookedAsSelf] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const slotRef = useRef(null);
  // The confirmation holds the one-time code. When it replaces the form, focus goes to it, so the
  // button the reader pressed does not vanish and leave them at the top of the page.
  const doneRef = useRef(null);

  // Only students and staff have a choice. Everyone else books anonymously because the other
  // route would refuse them.
  const canChoose = canOwnActivity(user);
  const asAnonymous = !canChoose || choice === 'anonymous';
  const mustChoose = canChoose && choice === null;

  const providerId = Number(id);
  const usableId = Number.isInteger(providerId) && providerId > 0;
  // The name says whose time is being asked for. If it cannot be loaded the page works without it:
  // the server still checks the entry when the request is sent.
  const { data: provider } = useApi(usableId ? `/directory/providers/${providerId}` : '');
  // Only an anonymous request has a code. The reader promises to save it before it is sent.
  const [acknowledged, setAcknowledged] = useState(false);
  // Which control a blocking message is about, so that control points at it. `errorCount` makes a
  // repeated message a new element, which a screen reader reads again.
  const [errorFor, setErrorFor] = useState(null);
  const [errorCount, setErrorCount] = useState(0);
  const fail = (err, target = null) => {
    setError(err);
    setErrorFor(target);
    setErrorCount((n) => n + 1);
  };

  useEffect(() => {
    if (anonToken || bookedAsSelf) doneRef.current?.focus();
  }, [anonToken, bookedAsSelf]);

  async function handleSubmit(event) {
    event.preventDefault();

    const problem = slotProblem(slot);
    if (problem) {
      fail({ message: problem }, 'slot');
      slotRef.current?.focus();
      return;
    }
    if (mustChoose) {
      fail({ message: 'Choose whether to send this with your name or without it.' });
      return;
    }
    if (asAnonymous && !acknowledged) {
      fail({ message: 'Tick the box to say you will save the code before leaving. It cannot be reissued.' }, 'saved-code');
      document.getElementById('saved-code')?.focus();
      return;
    }

    setError(null);
    setSending(true);
    try {
      const created = await apiPost(
        asAnonymous ? ANON_ENDPOINT : SELF_ENDPOINT,
        {
          provider_id: providerId,
          // Sent as an exact moment. The picker gives a time with no zone. The database would
          // read it in its own zone and the hour could be wrong.
          slot: new Date(slot).toISOString(),
          topic: topic.trim(),
        },
        asAnonymous ? { anonymous: true } : undefined,
      );

      // The server's reply decides the next screen. A token means an anonymous row was stored.
      if (created?.anon_token) {
        setAnonToken(created.anon_token);
        return;
      }
      if (asAnonymous) {
        // Without a code nobody can check this booking and there is no way to get one later.
        fail({
          message: 'Your request was sent but the server did not return a code so you cannot check it. Please tell us before trying again.' });
        return;
      }
      setBookedAsSelf(true);
    } catch (err) {
      // The form keeps what was typed. A reader must not lose their text on an error.
      fail(err);
    } finally {
      setSending(false);
    }
  }

  if (!usableId) {
    return (
      <div>
        <h1 className="font-head text-2xl text-primary">That booking link is not right</h1>
        <div className="mt-4 rounded-card border border-border bg-surface p-6">
          <p className="text-sm">Open the directory and use the booking button on the entry you want.</p>
          <Link to="/directory" className={`mt-3 inline-flex min-h-touch items-center 
            rounded bg-primary px-4 font-sans text-sm font-semibold text-primary-foreground ${RING}`}>
            Go to the directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Directory', to: '/directory' }]} current="Request consultation" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Request a consultation</h1>
      <p className="mt-3 text-muted-foreground">
        {provider?.name ? `${provider.name} · ` : ''}A request is not a confirmed appointment.
      </p>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-10">
      <div className="min-w-0">
      {anonToken ? (
        // The form is not shown with the code. A second send would make a second booking and a
        // second code and the first would be lost.
        <div ref={doneRef} tabIndex={-1} className="outline-none">
          <p className="mt-4">
            Your request is with the lawyer. They see the time and what it is about and nothing
            that says who you are.
          </p>
          <div className="mt-4">
            <TokenDisplay
              token={anonToken}
              purpose="check your booking"
              onContinue={() => navigate('/directory/booking-check')}
            />
          </div>
        </div>
      ) : bookedAsSelf ? (
        <div ref={doneRef} tabIndex={-1} className="mt-4 rounded-card border border-border bg-surface p-6 outline-none">
          <p>
            Your request is with the lawyer. Nobody will email you. Whether they accepted the time
            shows on the site under your account.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            There is no code. The request is kept with your account so the lawyer can see who asked.
          </p>
          <Link to="/my-activity" className={`mt-4 inline-flex min-h-touch items-center 
            rounded bg-primary px-4 font-sans font-semibold text-primary-foreground ${RING}`}>
            My activity
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-4 text-muted-foreground">
            {user
              ? 'The lawyer sees the time and what it is about. They accept it or ask for another.'
              : 'No account, no name, no email. The lawyer gets your request and accepts the time or asks for another.'}
          </p>
          {/* A visitor can still choose to sign in. Signed-in requests appear in My Activity. */}
          {!user && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link to={signInPath(here)} className={BUTTON_OUTLINE}>Sign in instead</Link>
              <p className="text-sm text-muted-foreground">Signed-in requests appear in My Activity.</p>
            </div>
          )}

          {/* Shown only while the request will be anonymous. The code cannot be reissued. */}
          {asAnonymous && (
            <Callout title="Before you send: keep your one-time code" className="mt-4">
              Sending this gives you a short code on the next screen. It is shown one time only
              and can never be reissued. Save it before you leave. It is the only way to find out
              whether the lawyer accepted.
            </Callout>
          )}

          {error && <ErrorNotice key={errorCount} id="booking-error" error={error} className="mt-4" />}

          <form onSubmit={handleSubmit} className="mt-4 rounded-card border border-border bg-surface p-6">
            <label htmlFor="slot" className="block text-sm font-semibold">Date and time</label>
            <p id="slot-hint" className="mt-1 text-sm text-muted-foreground">
              When would suit you? The lawyer can accept it or ask for another time.
            </p>
            <input
              id="slot"
              ref={slotRef}
              type="datetime-local"
              value={slot}
              onChange={(e) => { setSlot(e.target.value); if (errorFor === 'slot') setErrorFor(null); }}
              aria-describedby={errorFor === 'slot' ? 'slot-hint booking-error' : 'slot-hint'}
              aria-invalid={errorFor === 'slot' || undefined}
              className={FIELD}
            />

            <label htmlFor="topic" className="mt-4 block text-sm font-semibold">What is it about? (optional)</label>
            <p id="topic-hint" className="mt-1 text-sm text-muted-foreground">
              A line or two is enough. Leave out your name and anyone else’s if you can.
            </p>
            <textarea
              id="topic"
              rows={4}
              value={topic}
              maxLength={500}
              onChange={(e) => setTopic(e.target.value)}
              aria-describedby="topic-hint"
              placeholder="My landlord is keeping my deposit…"
              className={FIELD}
            />

            {canChoose && (
              <fieldset className="mt-4">
                <legend className="text-sm font-semibold">How do you want to send this?</legend>
                <label className="mt-2 flex min-h-touch cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="send-as"
                    checked={choice === 'self'}
                    onChange={() => { setChoice('self'); setAcknowledged(false); if (errorFor === 'saved-code') { setError(null); setErrorFor(null); } }}
                    className={`h-5 w-5 accent-primary ${RING}`}
                  />
                  <span>With my name ({user.name})</span>
                </label>
                <label className="flex min-h-touch cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="send-as"
                    checked={choice === 'anonymous'}
                    onChange={() => { setChoice('anonymous'); setAcknowledged(false); if (errorFor === 'saved-code') { setError(null); setErrorFor(null); } }}
                    className={`h-5 w-5 accent-primary ${RING}`}
                  />
                  <span>Without my name</span>
                </label>
              </fieldset>
            )}

            {asAnonymous && (
              <CheckField
                id="saved-code"
                className="mt-4"
                label="I understand that I must save the code before leaving."
                checked={acknowledged}
                onChange={(value) => { setAcknowledged(value); if (errorFor === 'saved-code') setErrorFor(null); }}
                describedBy={errorFor === 'saved-code' ? 'booking-error' : undefined}
                invalid={errorFor === 'saved-code'}
              />
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                aria-disabled={(sending || mustChoose) || undefined}
                className={`${sending || mustChoose ? BUTTON_DISABLED : BUTTON_PRIMARY} w-full sm:w-auto`}
              >
                {sending ? 'Sending the request…' : 'Send consultation request'}
              </button>
              <Link to="/directory" className={`${BUTTON_OUTLINE} w-full sm:w-auto`}>Cancel</Link>
            </div>
            {/* A grey button that explains nothing is a dead end. So this says why. */}
            {mustChoose && (
              <p className="mt-2 text-sm text-muted-foreground">Pick one of the two options above to send your request.</p>
            )}
          </form>

          <p className="mt-4 text-sm">
            <Link to="/directory/booking-check" className={BUTTON_TEXT}>
              Already requested? Check with your code<span aria-hidden="true">&nbsp;→</span>
            </Link>
          </p>
        </>
      )}
      </div>

      <aside className="self-start rounded-card border border-chrome-raised bg-chrome p-6 text-chrome-foreground" aria-labelledby="next-heading">
        <h2 id="next-heading" className="font-head text-2xl leading-heading">What happens next</h2>
        <dl className="mt-4 flex flex-col gap-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-on-chrome">You request</dt>
            <dd className="mt-0.5">Suggest a date and time.</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-on-chrome">The lawyer responds</dt>
            <dd className="mt-0.5">They accept the time or ask for another.</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-on-chrome">You check</dt>
            <dd className="mt-0.5">Use your code, or My Activity if you are signed in.</dd>
          </div>
        </dl>
      </aside>
      </div>
    </div>
  );
}

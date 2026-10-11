import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import TokenDisplay from '@/components/TokenDisplay';
import ErrorNotice from '@/components/ErrorNotice';
import { RING, RING_ON_CANVAS, FIELD } from '@/lib/ui';

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

  // Only students and staff have a choice. Everyone else books anonymously because the other
  // route would refuse them.
  const canChoose = canOwnActivity(user);
  const asAnonymous = !canChoose || choice === 'anonymous';
  const mustChoose = canChoose && choice === null;

  const providerId = Number(id);
  const usableId = Number.isInteger(providerId) && providerId > 0;

  async function handleSubmit(event) {
    event.preventDefault();

    const problem = slotProblem(slot);
    if (problem) {
      setError({ message: problem });
      slotRef.current?.focus();
      return;
    }
    if (mustChoose) {
      setError({ message: 'Choose whether to send this with your name or without it.' });
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
        setError({ 
          message: 'Your request was sent but the server did not return a code so you cannot check it. Please tell us before trying again.' });
        return;
      }
      setBookedAsSelf(true);
    } catch (err) {
      // The form keeps what was typed. A reader must not lose their text on an error.
      setError(err);
    } finally {
      setSending(false);
    }
  }

  if (!usableId) {
    return (
      <div>
        <h1 className="font-head text-2xl text-primary">That booking link is not right</h1>
        <div className="mt-4 rounded border border-border bg-surface p-4">
          <p className="text-sm">Open the directory and use the booking button on the entry you want.</p>
          <Link to="/directory" className={`mt-3 inline-flex min-h-touch items-center 
            rounded bg-primary px-4 font-head text-sm font-semibold text-primary-foreground ${RING}`}>
            Go to the directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Request a time with this lawyer</h1>

      {anonToken ? (
        // The form is not shown with the code. A second send would make a second booking and a
        // second code and the first would be lost.
        <>
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
        </>
      ) : bookedAsSelf ? (
        <div className="mt-4 rounded border border-border bg-surface p-4">
          <p>
            Your request is with the lawyer. Nobody will email you. Whether they accepted the time
            shows on the site under your account.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            There is no code. The request is kept with your account so the lawyer can see who asked.
          </p>
          <Link to="/my-activity" className={`mt-4 inline-flex min-h-touch items-center 
            rounded bg-primary px-4 font-head font-semibold text-primary-foreground ${RING}`}>
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

          {/* Shown only while the request will be anonymous. The code cannot be reissued. */}
          {asAnonymous && (
            <p className="mt-4 rounded border border-border bg-surface p-3 text-sm">
              Sending this gives you a short code on the next screen. It is shown one time only
              and can never be reissued. Save it before you leave. It is the only way to find out
              whether the lawyer accepted.
            </p>
          )}

          {error && <ErrorNotice error={error} className="mt-4" />}

          <form onSubmit={handleSubmit} className="mt-4 rounded border border-border bg-surface p-4">
            <label htmlFor="slot" className="block text-sm font-medium">Date and time</label>
            <p id="slot-hint" className="mt-1 text-sm text-muted-foreground">
              When would suit you? The lawyer can accept it or ask for another time.
            </p>
            <input
              id="slot"
              ref={slotRef}
              type="datetime-local"
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              aria-describedby="slot-hint"
              className={FIELD}
            />

            <label htmlFor="topic" className="mt-4 block text-sm font-medium">What is it about? (optional)</label>
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
                <legend className="text-sm font-medium">How do you want to send this?</legend>
                <label className="mt-2 flex min-h-touch cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="send-as"
                    checked={choice === 'self'}
                    onChange={() => setChoice('self')}
                    className={`h-5 w-5 accent-primary ${RING}`}
                  />
                  <span>With my name ({user.name})</span>
                </label>
                <label className="flex min-h-touch cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="send-as"
                    checked={choice === 'anonymous'}
                    onChange={() => setChoice('anonymous')}
                    className={`h-5 w-5 accent-primary ${RING}`}
                  />
                  <span>Without my name</span>
                </label>
              </fieldset>
            )}

            <button
              type="submit"
              disabled={sending || mustChoose}
              className={`mt-3 inline-flex min-h-touch items-center rounded px-4 font-head 
                font-semibold text-primary-foreground 
                ${RING} ${sending || mustChoose ? 'bg-disabled' : 'bg-primary'}`}
            >
              {sending ? 'Sending the request…' : 'Request this appointment'}
            </button>
            {/* A grey button that explains nothing is a dead end. So this says why. */}
            {mustChoose && (
              <p className="mt-2 text-sm text-muted-foreground">Pick one of the two options above to send your request.</p>
            )}
          </form>

          <p className="mt-4 text-sm">
            <Link to="/directory" className={`inline-flex min-h-touch items-center 
              font-semibold text-primary underline ${RING_ON_CANVAS}`}>
              Back to the directory
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

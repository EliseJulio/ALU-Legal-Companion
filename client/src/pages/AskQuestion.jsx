import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import TokenDisplay from '@/components/TokenDisplay';
import ErrorNotice from '@/components/ErrorNotice';
import { RING, RING_ON_CANVAS, FIELD, BUTTON_PRIMARY } from '@/lib/ui';

// There are two routes. The anonymous one ignores any login and stores no name. The other
// needs a student or staff login. The choice picks the URL and the flag together.
const ANON_ENDPOINT = '/questions/anonymous';
const SELF_ENDPOINT = '/questions';
const MAX_QUESTION = 5000;

// A real legal expert reads and answers every question in writing. No AI is involved.
export default function AskQuestion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  // Starts as null on purpose. Nothing is pre-selected, so a reader in a hurry cannot send under
  // their own name something they meant to keep anonymous.
  const [choice, setChoice] = useState(null);
  const [anonToken, setAnonToken] = useState(null);
  const [askedAsSelf, setAskedAsSelf] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const boxRef = useRef(null);

  // Only students and staff have a choice. Everyone else asks anonymously because the other
  // route would refuse them.
  const canChoose = canOwnActivity(user);
  const asAnonymous = !canChoose || choice === 'anonymous';
  const mustChoose = canChoose && choice === null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!text.trim()) {
      setError({ message: 'Write your question first.' });
      boxRef.current?.focus();
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
        { text: text.trim() },
        asAnonymous ? { anonymous: true } : undefined,
      );
      // The server's reply decides the next screen. A token means an anonymous row was stored.
      if (created?.anon_token) {
        setAnonToken(created.anon_token);
        return;
      }
      if (asAnonymous) {
        // Without a code nobody can read the answer and there is no way to get one later.
        setError({ message: 'Your question was sent but the server did not return a code, so you cannot read the answer. Please tell us before trying again.' });
        return;
      }
      setAskedAsSelf(true);
    } catch (err) {
      // The text stays in the box. A reader must not lose a long question to an error.
      setError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Ask a lawyer</h1>
      <p className="mt-1 text-muted-foreground">
        A real legal expert reads your question and answers it in writing. No AI is involved. This
        is legal information and not legal advice.
      </p>

      {anonToken ? (
        // The form is not shown with the code. A second send would make a second question and a
        // second code and the first would be lost.
        <>
          <p className="mt-4">Your question is with the legal team. They see the words you wrote and nothing that says who you are.</p>
          <div className="mt-4">
            <TokenDisplay token={anonToken} purpose="read the answer" onContinue={() => navigate('/ask/check')} />
          </div>
        </>
      ) : askedAsSelf ? (
        <div className="mt-4 rounded border border-border bg-surface p-4">
          <p>Your question is with the legal team. Nobody will email you. The answer appears on the site under your account.</p>
          <p className="mt-2 text-sm text-muted-foreground">There is no code. The question is kept with your account.</p>
          <Link to="/my-activity" className={`${BUTTON_PRIMARY} mt-4`}>My activity</Link>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm">
            If you are in danger right now, do not wait for an answer.{' '}
            <Link to="/emergency" className={`inline-flex min-h-touch items-center font-semibold text-primary underline ${RING_ON_CANVAS}`}>
              See the urgent numbers
            </Link>
          </p>

          {/* Shown only while the question will be anonymous. The code cannot be reissued. */}
          {asAnonymous && (
            <p className="mt-2 rounded border border-border bg-surface p-3 text-sm">
              Sending this gives you a short code on the next screen. It is shown one time only and
              can never be reissued. Save it before you leave. It is the only way to read the answer.
            </p>
          )}

          {error && <ErrorNotice error={error} className="mt-4" />}

          <form onSubmit={handleSubmit} className="mt-4 rounded border border-border bg-surface p-4">
            <label htmlFor="question" className="block text-sm font-medium">Your question</label>
            <p id="question-hint" className="mt-1 text-sm text-muted-foreground">
              Leave out your name and anyone else’s if you can. Say what happened and what you want to know.
            </p>
            <textarea
              id="question"
              ref={boxRef}
              rows={6}
              value={text}
              maxLength={MAX_QUESTION}
              onChange={(e) => setText(e.target.value)}
              aria-describedby="question-hint"
              className={FIELD}
            />

            {canChoose && (
              <fieldset className="mt-4">
                <legend className="text-sm font-medium">How do you want to send this?</legend>
                <label className="mt-2 flex min-h-touch cursor-pointer items-center gap-3 text-sm">
                  <input type="radio" name="send-as" checked={choice === 'self'} onChange={() => setChoice('self')} className={`h-5 w-5 accent-primary ${RING}`} />
                  <span>With my name ({user.name})</span>
                </label>
                <label className="flex min-h-touch cursor-pointer items-center gap-3 text-sm">
                  <input type="radio" name="send-as" checked={choice === 'anonymous'} onChange={() => setChoice('anonymous')} className={`h-5 w-5 accent-primary ${RING}`} />
                  <span>Without my name</span>
                </label>
              </fieldset>
            )}

            <button
              type="submit"
              disabled={sending || mustChoose}
              className={`mt-3 inline-flex min-h-touch items-center rounded px-4 font-head font-semibold text-primary-foreground ${RING} ${sending || mustChoose ? 'bg-disabled' : 'bg-primary'}`}
            >
              {sending ? 'Sending your question…' : 'Send my question'}
            </button>
            {/* A grey button that explains nothing is a dead end. So this says why. */}
            {mustChoose && (
              <p className="mt-2 text-sm text-muted-foreground">Pick one of the two options above to send your question.</p>
            )}
          </form>

          <p className="mt-4 text-sm">
            Already asked?{' '}
            <Link to="/ask/check" className={`inline-flex min-h-touch items-center font-semibold text-primary underline ${RING_ON_CANVAS}`}>
              Check for your answer with your code
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

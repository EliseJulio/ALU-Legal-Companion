import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signInPath } from '@/lib/url';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import TokenDisplay from '@/components/TokenDisplay';
import ErrorNotice from '@/components/ErrorNotice';
import Icon from '@/components/Icon';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import { CheckField } from '@/components/Field';
import { RING, RING_ON_CANVAS, FIELD, BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_DISABLED } from '@/lib/ui';

// There are two routes. The anonymous one ignores any login and stores no name. The other
// needs a student or staff login. The choice picks the URL and the flag together.
const ANON_ENDPOINT = '/questions/anonymous';
const SELF_ENDPOINT = '/questions';
const MAX_QUESTION = 5000;

// A human legal expert reads each question and may answer in writing. An answer is not promised.
export default function AskQuestion() {
  const { user } = useAuth();
  const here = useLocation();
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
  // The confirmation holds the one-time code. When it replaces the form, focus goes to it, so the
  // button the reader pressed does not vanish and leave them at the top of the page.
  const doneRef = useRef(null);
  // Only an anonymous question has a code. The reader promises to save it before it is sent.
  const [acknowledged, setAcknowledged] = useState(false);
  // Which control a blocking message is about, so that control points at it. errorCount makes a
  // repeated message a new element, which a screen reader reads again.
  const [errorFor, setErrorFor] = useState(null);
  const [errorCount, setErrorCount] = useState(0);
  const fail = (err, target = null) => {
    setError(err);
    setErrorFor(target);
    setErrorCount((n) => n + 1);
  };

  // Only students and staff have a choice. Everyone else asks anonymously because the other
  // route would refuse them.
  const canChoose = canOwnActivity(user);
  const asAnonymous = !canChoose || choice === 'anonymous';
  const mustChoose = canChoose && choice === null;

  useEffect(() => {
    if (anonToken || askedAsSelf) doneRef.current?.focus();
  }, [anonToken, askedAsSelf]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!text.trim()) {
      fail({ message: 'Write your question first.' }, 'question');
      boxRef.current?.focus();
      return;
    }
    if (mustChoose) {
      fail({ message: 'Choose whether to send this with your name or without it.' });
      return;
    }
    if (asAnonymous && !acknowledged) {
      fail({ message: 'Tick the box to say you understand the code cannot be recovered. It is shown once.' }, 'saved-code');
      document.getElementById('saved-code')?.focus();
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
        fail({ message: 'Your question was sent but the server did not return a code, so you cannot read the answer. Please tell us before trying again.' });
        return;
      }
      setAskedAsSelf(true);
    } catch (err) {
      // The text stays in the box. A reader must not lose a long question to an error.
      fail(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Ask an expert" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Ask a human legal expert</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">
        Send a written question to a human legal expert. A response is not guaranteed. Legal
        information, not legal advice.
      </p>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-10">
        <div className="min-w-0">
          {anonToken ? (
            // The form is not shown with the code. A second send would make a second question and a
            // second code and the first would be lost.
            <div ref={doneRef} tabIndex={-1} className="outline-none">
              <p>Your question is with the legal team. They see the words you wrote and nothing that says who you are.</p>
              <div className="mt-4">
                <TokenDisplay token={anonToken} purpose="read the answer" onContinue={() => navigate('/ask/check')} />
              </div>
            </div>
          ) : askedAsSelf ? (
            <div ref={doneRef} tabIndex={-1} className="rounded-card border border-border bg-surface p-6 outline-none">
              <p>Your question is with the legal team. Nobody will email you. The answer appears on the site under your account.</p>
              <p className="mt-2 text-sm text-muted-foreground">There is no code. The question is kept with your account.</p>
              <Link to="/my-activity" className={`${BUTTON_PRIMARY} mt-4`}>My activity</Link>
            </div>
          ) : (
            <>
              <p className="text-sm">
                If you are in danger right now, do not wait for an answer.{' '}
                <Link to="/emergency" className={`rounded font-semibold text-info underline ${RING_ON_CANVAS}`}>
                  See the urgent numbers
                </Link>
              </p>

              {/* Shown only while the question will be anonymous. The code cannot be reissued. */}
              {/* A visitor can still choose to sign in. Signed-in questions appear in My Activity. */}
              {!user && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link to={signInPath(here)} className={BUTTON_OUTLINE}>Sign in instead</Link>
                  <p className="text-sm text-muted-foreground">Signed-in questions appear in My Activity.</p>
                </div>
              )}

              {asAnonymous && (
                <Callout title="Your answer is retrieved with a one-time code" className="mt-3">
                  Sending this gives you a short code on the next screen. It is shown one time only and
                  can never be reissued. Save it before you leave. It is the only way to read the answer.
                </Callout>
              )}

              {error && <ErrorNotice key={errorCount} id="ask-error" error={error} className="mt-4" />}

              <form onSubmit={handleSubmit} className="mt-4 rounded-card border border-border bg-surface p-6">
                <label htmlFor="question" className="block text-sm font-semibold">Your question</label>
                <p id="question-hint" className="mt-1 text-sm text-muted-foreground">
                  Leave out your name and anyone else’s if you can. Say what happened and what you want to know.
                </p>
                <textarea
                  id="question"
                  ref={boxRef}
                  rows={6}
                  value={text}
                  maxLength={MAX_QUESTION}
                  onChange={(e) => { setText(e.target.value); if (errorFor === 'question') setErrorFor(null); }}
                  aria-describedby={errorFor === 'question' ? 'question-hint ask-error' : 'question-hint'}
                  aria-invalid={errorFor === 'question' || undefined}
                  className={FIELD}
                />

                {canChoose && (
                  <fieldset className="mt-4">
                    <legend className="text-sm font-semibold">How do you want to send this?</legend>
                    <label className="mt-2 flex min-h-touch cursor-pointer items-center gap-3 text-sm">
                      <input type="radio" name="send-as" checked={choice === 'self'} onChange={() => { setChoice('self'); setAcknowledged(false); if (errorFor === 'saved-code') { setError(null); setErrorFor(null); } }} className={`h-5 w-5 accent-primary ${RING}`} />
                      <span>With my name ({user.name})</span>
                    </label>
                    <label className="flex min-h-touch cursor-pointer items-center gap-3 text-sm">
                      <input type="radio" name="send-as" checked={choice === 'anonymous'} onChange={() => { setChoice('anonymous'); setAcknowledged(false); if (errorFor === 'saved-code') { setError(null); setErrorFor(null); } }} className={`h-5 w-5 accent-primary ${RING}`} />
                      <span>Without my name</span>
                    </label>
                  </fieldset>
                )}

                {asAnonymous && (
                  <CheckField
                    id="saved-code"
                    className="mt-4"
                    label="I understand the code cannot be recovered."
                    checked={acknowledged}
                    onChange={(value) => { setAcknowledged(value); if (errorFor === 'saved-code') setErrorFor(null); }}
                    describedBy={errorFor === 'saved-code' ? 'ask-error' : undefined}
                    invalid={errorFor === 'saved-code'}
                  />
                )}

                <button
                  type="submit"
                  aria-disabled={(sending || mustChoose) || undefined}
                  className={`mt-4 ${sending || mustChoose ? BUTTON_DISABLED : BUTTON_PRIMARY}`}
                >
                  {sending ? 'Sending your question…' : 'Send my question'}
                </button>
                {/* A grey button that explains nothing is a dead end. So this says why. */}
                {mustChoose && (
                  <p className="mt-2 text-sm text-muted-foreground">Pick one of the two options above to send your question.</p>
                )}
              </form>

              <p className="mt-4 text-sm">
                <Link to="/ask/check" className={`inline-flex min-h-touch items-center font-semibold text-info underline ${RING_ON_CANVAS}`}>
                  Already asked? Check for your answer<span aria-hidden="true">&nbsp;→</span>
                </Link>
              </p>
            </>
          )}
        </div>

        <aside className="self-start rounded-card border border-chrome-raised bg-chrome p-6 text-chrome-foreground" aria-label="Privacy and the signed-in option">
          <Icon name="lock" className="text-3xl" />
          <h2 className="mt-3 font-head text-2xl leading-heading">Only share what is needed</h2>
          <p className="mt-2 text-sm text-on-chrome">
            A short factual description and a clear question are enough to begin. Free text can still
            identify you, even if you do not give your name.
          </p>
          <h2 className="mt-6 font-head text-2xl leading-heading">Signed-in alternative</h2>
          <p className="mt-2 text-sm text-on-chrome">
            Account-linked questions and responses appear only in your private My Activity workspace.
            Anonymous questions stay outside that account history.
          </p>
        </aside>
      </div>
    </div>
  );
}

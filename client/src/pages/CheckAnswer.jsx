import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import ErrorNotice from '@/components/ErrorNotice';
import Breadcrumb from '@/components/Breadcrumb';
import StatusPill from '@/components/StatusPill';
import { RING, BUTTON_PRIMARY, BUTTON_DISABLED, BUTTON_OUTLINE, BUTTON_TEXT } from '@/lib/ui';

// Read the answer to an anonymous question with its code. The code is kept in state and goes
// only into the path of one request. It is never put in the address bar. The code alone opens
// the question. In the address it would stay in history and could be sent on to the next site.
// The server accepts any case and spaces and hyphens. So the page sends what was typed.
export default function CheckAnswer() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (checking) return;
    const typed = code.trim();
    if (!typed) {
      setResult(null);
      setError({ message: 'Type the code you were given, then press Check.' });
      return;
    }
    setError(null);
    setChecking(true);
    try {
      // Sent without a login. The code is the only key. A login adds nothing here.
      setResult(await apiGet(`/questions/anon/${encodeURIComponent(typed)}`, { anonymous: true }));
    } catch (err) {
      setResult(null);
      setError(err);
    } finally {
      setChecking(false);
    }
  }

  const answered = Boolean(result?.answer);
  const unknownCode = error?.status === 404;

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Check for your answer" />
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Check your request</p>
      <h1 className="mt-1 font-head text-4xl leading-heading text-primary md:text-5xl">Check for your answer</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">
        Type the code you were given when you asked. It is the only thing that connects you to your
        question. No name, no email and no account is stored with it. Anonymous requests are not added
        to My Activity.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-form rounded-card border border-border bg-surface p-6">
        <label htmlFor="answer-code" className="block text-sm font-semibold">Your question code</label>
        <p id="answer-code-hint" className="mt-1 text-sm text-muted-foreground">
          Sixteen characters in four groups. Small letters are fine.
        </p>
        <input
          id="answer-code"
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setResult(null); }}
          aria-describedby="answer-code-hint"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className={`mt-2 w-full min-h-touch rounded border border-input 
            bg-surface px-3 py-2 font-mono ${RING}`}
        />
        <button
          type="submit"
          aria-disabled={checking || undefined}
          className={`mt-4 ${checking ? BUTTON_DISABLED : BUTTON_PRIMARY}`}
        >
          {checking ? 'Checking…' : 'Check for answer'}
        </button>
        <p className="mt-3 text-sm text-muted-foreground">Lost codes cannot be recovered or reissued.</p>
      </form>

      {error && <ErrorNotice error={error} className="mt-4" />}
      {error?.status === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Try again when you have a connection. Keep the code you already saved.</p>
      )}

      {unknownCode && (
        <div className="mt-2 rounded-card border border-border bg-surface p-6">
          <h2 className="font-head text-base font-semibold text-primary">What to try next</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>Compare the code with the one you saved. A letter O is really a zero.</li>
            <li>
              A code that was mistyped and a code that was never issued give this same message.
              It tells you nothing about your question and nothing to anyone else.
            </li>
            <li>
              A lost code cannot be sent or reset because nothing here is linked to you. Signing in will not add this request to your account.{' '}
              <Link to="/ask" className={`font-semibold text-primary underline ${RING}`}>
                Ask your question again to get a new code
              </Link>
              .
            </li>
          </ol>
        </div>
      )}

      {/* The status region is always on the page so its first message is read out. */}
      <div role="status" className="mt-4">
        {checking && <p className="text-sm text-muted-foreground">Looking up your code…</p>}

        {result && answered && (
          <div className="rounded-card border border-border bg-surface p-6">
            <StatusPill status="answered" />
            <h2 className="mt-2 font-head text-2xl leading-heading text-primary">A legal expert has answered</h2>
            <p className="mt-3 text-xs font-medium text-muted-foreground">You asked</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{result.text}</p>
            <p className="mt-3 text-xs font-medium text-muted-foreground">The answer</p>
            <p className="mt-1 whitespace-pre-line">{result.answer}</p>
            <p className="mt-3 text-xs italic text-muted-foreground">Legal information not legal advice.</p>
          </div>
        )}

        {result && !answered && (
          <div className="rounded-card border border-border bg-surface p-6">
            <StatusPill status="pending" />
            <h2 className="mt-2 font-head text-2xl leading-heading text-primary">Awaiting a response</h2>
            <p className="mt-2 text-sm">No response yet. Check again with the code you saved.</p>
            <p className="mt-2 text-sm">
              Your question reached the legal team and is waiting for a reply. Nothing has gone
              wrong and you do not need to send it again.
            </p>
            <p className="mt-2 text-sm">Keep the code somewhere safe and come back later. It will still work.</p>
            <p className="mt-3 text-xs font-medium text-muted-foreground">You asked</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{result.text}</p>
            <button type="button" onClick={handleSubmit} aria-disabled={checking || undefined} className={`mt-4 ${BUTTON_OUTLINE}`}>{checking ? 'Checking…' : 'Check again'}</button>
            <p className="mt-3 text-sm text-muted-foreground">A response is not guaranteed. Do not wait here for urgent help.</p>
            <Link to="/emergency" className={`inline-flex min-h-touch items-center font-sans text-sm font-semibold text-warning-strong underline underline-offset-2 ${RING}`}>Emergency help →</Link>
          </div>
        )}
      </div>

      <p className="mt-4 text-sm">
        <Link to="/ask" className={BUTTON_TEXT}>Ask a new question</Link>
      </p>
    </div>
  );
}

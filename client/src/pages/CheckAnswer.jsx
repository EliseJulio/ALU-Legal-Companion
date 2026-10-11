import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import ErrorNotice from '@/components/ErrorNotice';
import { RING, RING_ON_CANVAS } from '@/lib/ui';

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
    const typed = code.trim();
    if (!typed) {
      setError({ message: 'Type the code you were given, then press Check.' });
      return;
    }
    setResult(null);
    setError(null);
    setChecking(true);
    try {
      // Sent without a login. The code is the only key. A login adds nothing here.
      setResult(await apiGet(`/questions/anon/${encodeURIComponent(typed)}`, { anonymous: true }));
    } catch (err) {
      setError(err);
    } finally {
      setChecking(false);
    }
  }

  const answered = Boolean(result?.answer);
  const unknownCode = error?.status === 404;

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Check for your answer</h1>
      <p className="mt-1 text-muted-foreground">
        Type the code you were given when you asked. It is the only thing that connects you to your
        question. No name, no email and no account is stored with it.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 rounded border border-border bg-surface p-4">
        <label htmlFor="answer-code" className="block text-sm font-medium">Your code</label>
        <p id="answer-code-hint" className="mt-1 text-sm text-muted-foreground">
          Sixteen characters in four groups. Small letters are fine.
        </p>
        <input
          id="answer-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-describedby="answer-code-hint"
          autoComplete="off"
          spellCheck="false"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className={`mt-2 w-full min-h-touch rounded border border-input 
            bg-surface px-3 py-2 font-mono ${RING}`}
        />
        <button
          type="submit"
          disabled={checking}
          className={`mt-3 inline-flex min-h-touch items-center rounded px-4 font-head font-semibold 
            text-primary-foreground ${RING} ${checking ? 'bg-disabled' : 'bg-primary'}`}
        >
          {checking ? 'Checking…' : 'Check for an answer'}
        </button>
      </form>

      {error && <ErrorNotice error={error} className="mt-4" />}

      {unknownCode && (
        <div className="mt-2 rounded border border-border bg-surface p-4">
          <h2 className="font-head text-base font-semibold text-primary">What to try next</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>Compare the code with the one you saved. A letter O is really a zero.</li>
            <li>
              A code that was mistyped and a code that was never issued give this same message.
              It tells you nothing about your question and nothing to anyone else.
            </li>
            <li>
              A lost code cannot be sent or reset because nothing here is linked to you.{' '}
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
          <div className="rounded border border-border bg-surface p-4">
            <h2 className="font-head text-lg font-semibold text-primary">A legal expert has answered</h2>
            <p className="mt-3 text-xs font-medium text-muted-foreground">You asked</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{result.text}</p>
            <p className="mt-3 text-xs font-medium text-muted-foreground">The answer</p>
            <p className="mt-1 whitespace-pre-line">{result.answer}</p>
            <p className="mt-3 text-xs italic text-muted-foreground">Legal information not legal advice.</p>
          </div>
        )}

        {result && !answered && (
          <div className="rounded border border-border bg-surface p-4">
            <h2 className="font-head text-lg font-semibold text-primary">No answer yet</h2>
            <p className="mt-2 text-sm">
              Your question reached the legal team and is waiting for a reply. Nothing has gone
              wrong and you do not need to send it again.
            </p>
            <p className="mt-2 text-sm">Keep the code somewhere safe and come back later. It will still work.</p>
            <p className="mt-3 text-xs font-medium text-muted-foreground">You asked</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{result.text}</p>
          </div>
        )}
      </div>

      <p className="mt-4 text-sm">
        <Link to="/ask" className={`inline-flex min-h-touch items-center font-semibold text-primary underline ${RING_ON_CANVAS}`}>
          Ask a new question
        </Link>
      </p>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import CrisisAlert from '@/components/CrisisAlert';
import ErrorNotice from '@/components/ErrorNotice';
import { CheckField } from '@/components/Field';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, CARD, FORM_TEXTAREA, PAGE_TITLE, RING_ON_CANVAS } from '@/lib/ui';

const MIN_QUESTION = 5;
const MAX_QUESTION = 500;
const UNAVAILABLE = 'Ask AI is not available right now.';

// Answers a question from the published guides with a Google Gemini model. The question is
// prefilled from ?q=, but nothing is sent until the person ticks the box and presses Ask.
export default function AskAI() {
  const [params] = useSearchParams();
  const [text, setText] = useState(() => (params.get('q') ?? '').slice(0, MAX_QUESTION));
  const [understood, setUnderstood] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const answerRef = useRef(null);

  // Whether Ask AI is set up. A failed check counts as not set up.
  const { data: status, error: statusError, loading: checking } = useApi('/ask-ai/status');
  const available = !statusError && status?.available === true;

  // Moves focus to the answer when it arrives, so a keyboard or screen reader user hears it.
  useEffect(() => {
    if (result || error) answerRef.current?.focus();
  }, [result, error]);

  const trimmed = text.trim();
  const canAsk = understood && trimmed.length >= MIN_QUESTION && !sending;

  async function ask(event) {
    event.preventDefault();
    if (!canAsk) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      setResult(await apiPost('/ask-ai', { question: trimmed }));
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  const links = (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <Link to="/guides" className={BUTTON_OUTLINE}>Browse the guides</Link>
      <Link to="/ask" className={BUTTON_OUTLINE}>Ask a legal expert</Link>
    </div>
  );

  let body;
  if (checking) {
    body = <p role="status" className="mt-6 text-muted-foreground">Checking Ask AI…</p>;
  } else if (!available) {
    body = (
      <div className={`mt-6 ${CARD}`}>
        <p className="font-medium">{UNAVAILABLE}</p>
        {links}
      </div>
    );
  } else {
    body = (
      <>
        <div className="mt-6">
          <CrisisAlert />
        </div>

        <div className={`mt-6 ${CARD}`}>
          <p className="text-sm">
            Your question is sent to an AI service run by Google and may be used to improve its products.
            Do not enter personal details.
          </p>
          <CheckField
            id="ask-ai-understood"
            className="mt-3"
            label="I understand"
            checked={understood}
            onChange={setUnderstood}
          />
        </div>

        <form onSubmit={ask} className={`mt-6 ${CARD}`}>
          <label htmlFor="ask-ai-question" className="block text-sm font-semibold">Your question</label>
          <textarea
            id="ask-ai-question"
            rows={4}
            value={text}
            disabled={!understood}
            maxLength={MAX_QUESTION}
            onChange={(e) => setText(e.target.value)}
            aria-describedby="ask-ai-hint ask-ai-count"
            className={FORM_TEXTAREA}
          />
          <p id="ask-ai-count" className="mt-1 text-right text-sm text-muted-foreground">
            {text.length} of {MAX_QUESTION} characters
          </p>

          <button
            type="submit"
            aria-disabled={canAsk ? undefined : true}
            className={`mt-4 ${BUTTON_PRIMARY}`}
          >
            {sending ? 'Asking…' : 'Ask'}
          </button>
          <p id="ask-ai-hint" className="mt-2 text-sm text-muted-foreground">
            {!understood
              ? 'Tick “I understand” to ask a question.'
              : trimmed.length < MIN_QUESTION
                ? `Write at least ${MIN_QUESTION} characters.`
                : 'Press Ask to send your question.'}
          </p>
        </form>

        {sending && <p role="status" className="mt-6 text-muted-foreground">Thinking…</p>}
        {error && <ErrorNotice error={error} className="mt-6" />}

        {result && (
          <div ref={answerRef} tabIndex={-1} className={`mt-6 outline-none ${CARD}`}>
            {result.answered ? (
              <>
                <p className="whitespace-pre-line text-ink">{result.answer}</p>
                <p className="mt-4 text-sm">
                  <span className="font-semibold">Source: </span>
                  {result.sources.map((source, index) => (
                    <span key={source.id}>
                      {index > 0 && ', '}
                      <Link to={`/guides/${source.id}`} className={`font-semibold text-info underline underline-offset-4 ${RING_ON_CANVAS}`}>
                        {source.title}
                      </Link>
                    </span>
                  ))}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  AI answers may be wrong. Legal information, not legal advice.
                </p>
              </>
            ) : (
              <p className="text-ink">{result.message}</p>
            )}
            {links}
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Ask AI" />
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Ask AI</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">
        Ask a question about the published legal guides and 
        get a short answer in simple terms and words.
      </p>
      {body}
    </div>
  );
}

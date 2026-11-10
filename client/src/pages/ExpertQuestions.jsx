import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { LIVE } from '@/lib/live';
import ErrorNotice from '@/components/ErrorNotice';
import { readableDate } from '@/lib/dates';
import { CARD, FORM_TEXTAREA, RING, BUTTON_PRIMARY, PAGE_TITLE, pillClass } from '@/lib/ui';

// The words for `kind`. The server says only whether a question is anonymous. It sends nothing
// else about who asked. This page adds nothing.
const KIND_WORDS = { anonymous: 'Anonymous question', 'signed-in': 'Question from a signed-in student or staff member' };

function AnswerForm({ question, onDone }) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function send(event) {
    event.preventDefault();
    if (!answer.trim()) {
      setError({ message: 'Write the answer first.' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/questions/${question.id}/answer`, { answer: answer.trim() });
      onDone();
    } catch (err) {
      // For example "already answered" when another expert got there first.
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="mt-4">
      <label htmlFor="written-answer" className="block text-sm font-medium">Your written answer</label>
      <textarea
        id="written-answer"
        rows={8}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        aria-describedby="answer-note"
        aria-required="true"
        placeholder="Provide clear legal information and name any source limits…"
        className={FORM_TEXTAREA}
      />
      <p id="answer-note" className="mt-2 text-sm text-muted-foreground">
        Required. Legal information, not legal advice. Use confirmed references only.
      </p>
      {error && <ErrorNotice error={error} className="mt-2" />}
      <button type="submit" aria-disabled={busy || undefined} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-3`}>
        {busy ? 'Sending…' : 'Send the answer'}
      </button>
    </form>
  );
}

// The chosen question in full with its one answer box. It is keyed by the question, so a half
// written answer never moves to another question.
function QuestionPane({ question, headingRef, onDone }) {
  return (
    <article className={CARD} aria-labelledby="question-heading">
      <h2 id="question-heading" ref={headingRef} tabIndex={-1} className="font-head text-base leading-[1.3] text-ink focus:outline-none">The question<span className="sr-only"> from {KIND_WORDS[question.kind]?.toLowerCase() ?? 'a reader'}, {readableDate(question.created_at)}</span></h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {KIND_WORDS[question.kind] ?? 'Question'} · {readableDate(question.created_at)}
      </p>
      <p className="mt-3.5 whitespace-pre-line text-[15px] leading-relaxed">{question.text}</p>
      <Callout title="Minimise identifying information" className="mt-4">
        Account identity is not shown. Free text can still identify a person, so do not repeat
        unnecessary sensitive details in your answer.
      </Callout>
      <AnswerForm question={question} onDone={onDone} />
    </article>
  );
}

// Open questions with the oldest first and the chosen one beside them.
// Anonymous questions have no name and no account behind them.
export default function ExpertQuestions() {
  const { data: questions, error, loading, refetch } = useApi('/questions/open', LIVE);
  // A link from the bell can name the question: ?question=ID. That one is open when the page loads.
  const [params] = useSearchParams();
  const [chosen, setChosen] = useState(() => Number(params.get('question')) || null);
  // A new object each time, so the same words twice still move focus to the message again.
  const [notice, setNotice] = useState(null);
  const heading = useRef(null);
  const moved = useRef(false);
  const status = useRef(null);

  const current = questions?.find((q) => q.id === chosen) ?? questions?.[0];

  // Only a choice made by the reader moves focus. The first question on load does not.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = false;
  }, [chosen]);

  // The answered question leaves the list and takes the focused button with it. Focus goes to the
  // message so the reader hears that the answer was sent.
  useEffect(() => {
    if (notice) status.current?.focus();
  }, [notice]);

  function choose(question) {
    moved.current = true;
    setNotice(null);
    setChosen(question.id);
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Expert workspace' }]} current="Questions" />
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Questions from the community</h1>
      <p className="mt-2.5 max-w-reading text-sm text-muted-foreground">
        Oldest first. Anonymous and signed-in questions do not disclose account identity to the
        expert. Answer in simple words.
      </p>

      {/* Always on the page so a sent answer is read out. */}
      <p ref={status} tabIndex={-1} role="status" className="mt-4 text-sm font-medium focus:outline-none">{notice?.text}</p>

      {loading && !questions && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {questions?.length === 0 && <p className={`mt-6 text-muted-foreground ${CARD}`}>No questions are waiting.</p>}

      {questions?.length > 0 && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          {/* One card with a row per question. The chosen row gets a soft blue tint. */}
          {/* No overflow clip here: it would cut off the focus ring of the first and last row. Each row takes
              the card's corners instead, so its own colour stops at the card's edge. */}
          <ul aria-label="Open questions" className="min-w-0 rounded-card border border-border bg-surface">
            {questions.map((question) => (
              <li key={question.id} className="relative border-t border-border first:border-t-0 focus-within:z-10 first:[&>button]:rounded-t-card last:[&>button]:rounded-b-card">
                <button
                  type="button"
                  aria-current={current?.id === question.id ? 'true' : undefined}
                  onClick={() => choose(question)}
                  className={`flex w-full min-h-touch flex-wrap items-start justify-between gap-2 p-[18px] text-left ${RING} focus-visible:ring-offset-surface ${current?.id === question.id ? 'bg-primary-subtle font-semibold' : 'hover:bg-chrome-raised'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">
                      {KIND_WORDS[question.kind] ?? 'Question'} · {readableDate(question.created_at)}
                    </span>
                    <span className="mt-1 line-clamp-3 block text-sm font-semibold text-ink">{question.text}</span>
                  </span>
                  {/* A question with no answer yet is waiting. The word says it, not the colour. */}
                  <span className={pillClass('neutral')}>Waiting</span>
                </button>
              </li>
            ))}
          </ul>

          {current && (
            <QuestionPane
              key={current.id}
              question={current}
              headingRef={heading}
              onDone={() => { setNotice({ text: 'Answer sent.' }); setChosen(null); refetch(); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

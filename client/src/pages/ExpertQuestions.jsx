import { useEffect, useRef, useState } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import { readableDate } from '@/lib/dates';
import { PANEL, FIELD, RING, BUTTON_PRIMARY } from '@/lib/ui';

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
        className={FIELD}
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
    <article className={PANEL} aria-labelledby="question-heading">
      <h2 id="question-heading" ref={headingRef} tabIndex={-1} className="font-head text-3xl leading-heading text-primary focus:outline-none">The question<span className="sr-only"> from {KIND_WORDS[question.kind]?.toLowerCase() ?? 'a reader'}, {readableDate(question.created_at)}</span></h2>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        {KIND_WORDS[question.kind] ?? 'Question'} · {readableDate(question.created_at)}
      </p>
      <p className="mt-3 whitespace-pre-line">{question.text}</p>
      <Callout title="Minimise identifying information" className="mt-4">
        Account identity is not shown. Free text can still identify a person, so do not repeat
        unnecessary sensitive details in your answer.
      </Callout>
      <AnswerForm question={question} onDone={onDone} />
    </article>
  );
}

// Open questions, oldest first, with the chosen one beside them. Anonymous questions have no name
// and no account behind them.
export default function ExpertQuestions() {
  const { data: questions, error, loading, refetch } = useApi('/questions/open');
  const [chosen, setChosen] = useState(null);
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
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Questions from the community.</h1>
      <p className="mt-3 max-w-reading text-muted-foreground">
        Oldest first. Anonymous and signed-in questions do not disclose account identity to the
        expert. Answer in simple words.
      </p>

      {/* Always on the page so a sent answer is read out. */}
      <p ref={status} tabIndex={-1} role="status" className="mt-4 text-sm font-medium focus:outline-none">{notice?.text}</p>

      {loading && !questions && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {questions?.length === 0 && <p className={`mt-6 text-muted-foreground ${PANEL}`}>No questions are waiting.</p>}

      {questions?.length > 0 && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <ul aria-label="Open questions" className="min-w-0 space-y-3">
            {questions.map((question) => (
              <li key={question.id}>
                <button
                  type="button"
                  aria-current={current?.id === question.id ? 'true' : undefined}
                  onClick={() => choose(question)}
                  className={`block w-full rounded-card border p-4 text-left ${RING} ${current?.id === question.id ? 'border-primary border-l-8 bg-surface' : 'border-border bg-surface hover:border-primary'}`}
                >
                  <span className="block text-xs font-medium text-muted-foreground">
                    {KIND_WORDS[question.kind] ?? 'Question'} · {readableDate(question.created_at)}
                  </span>
                  <span className="mt-2 line-clamp-3 block font-head text-xl leading-heading text-primary">{question.text}</span>
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

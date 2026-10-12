import { useState } from 'react';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import { readableDate } from '@/lib/dates';
import { PANEL, FIELD, BUTTON_PRIMARY } from '@/lib/ui';

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
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="mt-3">
      <label htmlFor={`answer-${question.id}`} className="block text-sm font-medium">Your answer</label>
      <textarea id={`answer-${question.id}`} rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} className={FIELD} />
      {error && <ErrorNotice error={error} className="mt-2" />}
      <button type="submit" disabled={busy} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-3`}>
        {busy ? 'Sending…' : 'Send the answer'}
      </button>
    </form>
  );
}

// Open questions, oldest first. Anonymous questions have no name and no account behind them.
export default function ExpertQuestions() {
  const { data: questions, error, loading, refetch } = useApi('/questions/open');

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Questions</h1>
      <p className="mt-1 text-muted-foreground">
        Questions waiting for a written answer, oldest first. Answer in plain language. This is
        legal information and not legal advice.
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {questions?.length === 0 && <p className={`mt-6 text-muted-foreground ${PANEL}`}>No questions are waiting.</p>}

      <ul className="mt-6 space-y-4">
        {questions?.map((question) => (
          <li key={question.id} className={PANEL}>
            <p className="text-xs font-medium text-muted-foreground">
              {KIND_WORDS[question.kind] ?? 'Question'} · {readableDate(question.created_at)}
            </p>
            <p className="mt-2 whitespace-pre-line">{question.text}</p>
            <AnswerForm question={question} onDone={refetch} />
          </li>
        ))}
      </ul>
    </div>
  );
}

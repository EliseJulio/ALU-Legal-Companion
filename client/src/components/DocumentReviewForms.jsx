import { useState } from 'react';
import Field from '@/components/Field';
import { BUTTON_PRIMARY, FIELD } from '@/lib/ui';

// The three verdicts a lawyer can give a file.
const VERDICTS = [
  ['complete', 'Complete'],
  ['needs_fix', 'Needs fixing'],
  ['out_of_date', 'Out of date'],
];

export function ReviewForm({ doc, onSave, busy }) {
  const [status, setStatus] = useState(doc.review.status === 'pending' ? 'complete' : doc.review.status);
  const [note, setNote] = useState(doc.review.note ?? '');
  const needsNote = status !== 'complete';
  return (
    <form
      className="mt-3 border-t border-border pt-3"
      onSubmit={(event) => { event.preventDefault(); onSave(doc, { status, note: note.trim() }); }}
    >
      {/* The verdict is a group of radio buttons. Each is a word in a 44 px box. The chosen one is inverted. */}
      <fieldset>
        <legend className="text-sm font-medium">Your check of this file</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {VERDICTS.map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name={`verdict-${doc.id}`}
                value={value}
                checked={status === value}
                onChange={() => setStatus(value)}
                className="peer sr-only"
              />
              <span className="inline-flex min-h-touch items-center rounded-control border border-control px-4 text-sm font-medium text-ink peer-checked:border-primary peer-checked:bg-primary-subtle peer-checked:font-semibold peer-checked:text-primary-text peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        id={`note-${doc.id}`}
        label={`Note ${needsNote ? '(required. Say what is wrong so the owner knows what to fix)' : '(optional)'}`}
        as="textarea"
        rows={2}
        className="mt-2"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button type="submit" aria-disabled={(busy || (needsNote && !note.trim())) || undefined} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-3`}>
        Save my check
      </button>
    </form>
  );
}

// The lawyer's comment box. A comment is separate from the check above it. A lawyer can ask a
// question without changing Complete or Needs fixing. The box clears only when the comment was
// saved so a failed save does not lose what was typed.
export function CommentForm({ doc, onSave, busy }) {
  const [body, setBody] = useState('');
  return (
    <form
      className="mt-3 border-t border-border pt-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onSave(doc, body.trim())) setBody('');
      }}
    >
      <label htmlFor={`comment-${doc.id}`} className="block text-sm font-medium">
        Add a comment<span className="sr-only"> on {doc.label}</span>
      </label>
      <textarea id={`comment-${doc.id}`} rows={2} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} className={FIELD} />
      <button type="submit" aria-disabled={(busy || !body.trim()) || undefined} aria-busy={busy} aria-label={`Post comment on ${doc.label}`} className={`${BUTTON_PRIMARY} mt-2`}>
        Post comment
      </button>
    </form>
  );
}

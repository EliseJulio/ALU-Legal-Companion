import { useState } from 'react';
import { apiPost } from '@/lib/api';
import ErrorNotice from '@/components/ErrorNotice';
import { FIELD, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

// The two things a legal expert can do with a record that is waiting for review. Verify it so it
// goes public with their name on it. Or return it with a reason. The same two endpoints exist
// for guides, directory entries and routes. `path` is the record, for example "/guides/3".
export default function ReviewActions({ path, onDone, className = '' }) {
  const [returning, setReturning] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function act(step, body) {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`${path}/${step}`, body);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  function sendBack(event) {
    event.preventDefault();
    if (!comment.trim()) {
      setError({ message: 'Please say what needs changing before returning it.' });
      return;
    }
    act('return', { comment: comment.trim() });
  }

  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">
        Verifying says you have checked this against the law and the body’s own source. It goes
        public with your name on it.
      </p>

      {!returning ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={busy} aria-busy={busy} className={BUTTON_PRIMARY} onClick={() => act('verify')}>
            Verify and publish
          </button>
          <button type="button" disabled={busy} className={BUTTON_OUTLINE} onClick={() => setReturning(true)}>
            Return with a comment
          </button>
        </div>
      ) : (
        <form onSubmit={sendBack} className="mt-3">
          <label htmlFor={`comment-${path}`} className="block text-sm font-medium">What needs changing</label>
          <textarea
            id={`comment-${path}`}
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={FIELD}
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="submit" disabled={busy} aria-busy={busy} className={BUTTON_PRIMARY}>Send it back</button>
            <button type="button" disabled={busy} className={BUTTON_OUTLINE} onClick={() => { setReturning(false); setError(null); }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <ErrorNotice error={error} className="mt-3" />}
    </div>
  );
}

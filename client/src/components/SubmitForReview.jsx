import { useState } from 'react';
import { apiPost } from '@/lib/api';
import ErrorNotice from '@/components/ErrorNotice';
import { BUTTON_OUTLINE } from '@/lib/ui';

// Send a draft to the legal experts. This is as far as an admin can take a guide, an entry or a
// route. There is no publish button for an admin anywhere. `path` is the record, for example
// "/guides/3".
export default function SubmitForReview({ path, onDone, className = '' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`${path}/submit`);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button type="button" disabled={busy} aria-busy={busy} className={BUTTON_OUTLINE} onClick={send}>
        Send for review
      </button>
      {error && <ErrorNotice error={error} className="mt-2" />}
    </div>
  );
}

import { useState } from 'react';
import { apiPost } from '@/lib/api';
import ErrorNotice from '@/components/ErrorNotice';
import { ADMIN_BUTTON_OUTLINE } from '@/components/AdminRecords';

// Publishes a draft directly. There is no separate step. `path` is the record such as "/guides/3".
export default function SubmitForReview({ path, onDone, className = '' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`${path}/publish`);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button type="button" aria-disabled={busy || undefined} aria-busy={busy} className={ADMIN_BUTTON_OUTLINE} onClick={send}>
        Publish
      </button>
      {error && <ErrorNotice error={error} className="mt-2" />}
    </div>
  );
}

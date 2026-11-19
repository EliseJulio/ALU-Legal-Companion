import { useEffect, useRef, useState } from 'react';
import { apiDelete } from '@/lib/api';
import ErrorNotice from '@/components/ErrorNotice';
import { BUTTON_DESTRUCTIVE, BUTTON_DANGER_SOLID, BUTTON_OUTLINE } from '@/lib/ui';

// The controls under one line of the record. They appear only on an entry the owner wrote, which the
// server marks with can_delete. A line the system wrote and a lawyer's note get none.
// Each action asks first, inside the page, and sends nothing until the person confirms.
export default function RecordEntryActions({ matterId, event, onDone }) {
  const [asking, setAsking] = useState(null); // 'entry', 'file' or null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const keep = useRef(null);

  // The safe choice gets focus when a question opens.
  useEffect(() => { if (asking) keep.current?.focus(); }, [asking]);

  if (!event.can_delete) return null;

  async function confirm(what) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/matters/${matterId}/events/${event.id}${what === 'file' ? '/file' : ''}`);
      setAsking(null);
      onDone(what);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const hasFile = Boolean(event.file);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          aria-expanded={asking === 'entry'}
          onClick={() => setAsking(asking === 'entry' ? null : 'entry')}
          className={BUTTON_DESTRUCTIVE}
        >
          Delete this entry
        </button>
        {hasFile && (
          <button
            type="button"
            aria-expanded={asking === 'file'}
            onClick={() => setAsking(asking === 'file' ? null : 'file')}
            className={BUTTON_DESTRUCTIVE}
          >
            Remove the file
          </button>
        )}
      </div>

      {asking === 'entry' && (
        <div role="group" aria-label="Confirm deleting this entry" className="mt-3 rounded-control border border-control p-3">
          <p className="text-sm text-ink">Delete this entry? The text and its file are removed. This cannot be undone.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button ref={keep} type="button" className={BUTTON_OUTLINE} onClick={() => setAsking(null)}>Keep the entry</button>
            <button type="button" className={BUTTON_DANGER_SOLID} aria-disabled={busy || undefined} aria-busy={busy} onClick={() => confirm('entry')}>
              Yes, delete the entry
            </button>
          </div>
        </div>
      )}

      {asking === 'file' && hasFile && (
        <div role="group" aria-label="Confirm removing the file" className="mt-3 rounded-control border border-control p-3">
          <p className="text-sm text-ink">Remove the file {event.file.name}? The text of the entry stays. This cannot be undone.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button ref={keep} type="button" className={BUTTON_OUTLINE} onClick={() => setAsking(null)}>Keep the file</button>
            <button type="button" className={BUTTON_DANGER_SOLID} aria-disabled={busy || undefined} aria-busy={busy} onClick={() => confirm('file')}>
              Yes, remove the file
            </button>
          </div>
        </div>
      )}

      {error && <ErrorNotice error={error} className="mt-2" />}
    </div>
  );
}

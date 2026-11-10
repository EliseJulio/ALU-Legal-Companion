import { useId, useRef, useState } from 'react';
import { apiBlob } from '@/lib/api';
import ErrorNotice from '@/components/ErrorNotice';
import { RING, BUTTON_OUTLINE } from '@/lib/ui';
import { problemWithFile } from '@/lib/recordFile';

// An optional file on one line of the record. The checks live in lib/recordFile.js.
const ACCEPT = 'application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg';

const kb = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`);

// The field in the "Add to your record" form. The page keeps the chosen file and sends it.
export default function RecordAttachment({ file, onChange, disabled = false }) {
  const id = useId();
  const [problem, setProblem] = useState(null);
  // A new key empties the native box after Remove, so the same file can be chosen again.
  const [round, setRound] = useState(0);
  const input = useRef(null);

  function choose(event) {
    const picked = event.target.files?.[0] ?? null;
    if (!picked) return;
    const bad = problemWithFile(picked);
    setProblem(bad);
    if (bad) { setRound((n) => n + 1); onChange(null); return; }
    onChange(picked);
  }

  function remove() {
    if (disabled) return;
    setProblem(null);
    setRound((n) => n + 1);
    onChange(null);
    // The input is about to be replaced, so focus waits for it.
    setTimeout(() => document.getElementById(id)?.focus(), 0);
  }

  return (
    <div className="mt-3">
      {file ? (
        <p className="block text-sm font-medium">Attach a document (optional)</p>
      ) : (
        <label htmlFor={id} className="block text-sm font-medium">Attach a document (optional)</label>
      )}
      <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">PDF, JPG or PNG, up to 5 MB. Kept private and encrypted.</p>
      {file ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="min-w-0 break-all text-sm font-medium text-ink">
            {file.name} <span className="font-normal text-muted-foreground">({kb(file.size)})</span>
          </p>
          <button type="button" className={BUTTON_OUTLINE} aria-disabled={disabled || undefined} onClick={remove} aria-label={`Remove ${file.name}`}>
            Remove
          </button>
        </div>
      ) : (
        <input
          key={round}
          ref={input}
          id={id}
          type="file"
          accept={ACCEPT}
          disabled={disabled}
          aria-describedby={`${id}-hint`}
          onChange={choose}
          className={`mt-2 block min-h-touch w-full text-sm ${RING}`}
        />
      )}
      {problem && <ErrorNotice error={{ message: problem }} className="mt-2" />}
    </div>
  );
}

// The file name on a line of the record, as a control that downloads it. A plain link cannot send
// the login, so the page fetches the file and hands the browser the bytes.
export function RecordFileLink({ matterId, event }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!event.file) return null;

  async function download() {
    setError(null);
    setBusy(true);
    try {
      const blob = await apiBlob(`/matters/${matterId}/events/${event.id}/file`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = event.file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {' · '}
      <button
        type="button"
        onClick={download}
        aria-busy={busy || undefined}
        aria-label={`Download ${event.file.name}`}
        className={`inline-flex min-h-touch max-w-full items-center break-all text-left text-xs font-semibold normal-case tracking-normal text-info underline underline-offset-2 ${RING}`}
      >
        {event.file.name}
      </button>
      {error && <span role="alert" className="mt-1 block text-sm font-normal normal-case tracking-normal text-warning-strong">{error.message}</span>}
    </>
  );
}

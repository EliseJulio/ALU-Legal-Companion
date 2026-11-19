import { useEffect, useRef, useState } from 'react';
import ErrorNotice from '@/components/ErrorNotice';
import { usePanelFocus } from '@/lib/panelFocus';
import { BUTTON_DANGER_SOLID, BUTTON_OUTLINE, BUTTON_DESTRUCTIVE } from '@/lib/ui';

// Cancels one consultation after an inline question. The page passes `onCancel`, which makes the request
// for a signed-in or an anonymous booking. The question is inline so no browser dialog is used.
// The question opens on the safe choice, Keep it. Keep it returns focus to the cancel button.
export default function CancelConsultation({ when, onCancel, onDone, className = '' }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const { firstRef: keepRef, openerRef: cancelRef } = usePanelFocus(confirming);
  // The button is gone once the message shows, so the message takes focus.
  const doneRef = useRef(null);
  useEffect(() => { if (done) doneRef.current?.focus(); }, [done]);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCancel();
      setDone(true);
      setConfirming(false);
      onDone?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p ref={doneRef} tabIndex={-1} role="status" className={`mt-2 text-sm font-semibold text-ink outline-none ${className}`}>Cancelled.</p>;
  }

  if (!confirming) {
    return (
      <div className={className}>
        <button ref={cancelRef} type="button" className={BUTTON_DESTRUCTIVE} onClick={() => setConfirming(true)}>
          Cancel this consultation
        </button>
        {error && <ErrorNotice error={error} className="mt-2" />}
      </div>
    );
  }

  return (
    <div role="group" aria-label={`Cancel the consultation for ${when}`} className={`rounded-control border border-border bg-chrome-raised p-3 ${className}`}>
      <p className="text-sm font-semibold text-ink">Cancel the consultation for {when}?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" aria-disabled={busy || undefined} className={BUTTON_DANGER_SOLID} onClick={confirm}>
          {busy ? 'Cancelling…' : 'Yes, cancel it'}
        </button>
        <button ref={keepRef} type="button" className={BUTTON_OUTLINE} onClick={() => setConfirming(false)}>Keep it</button>
      </div>
      {error && <ErrorNotice error={error} className="mt-2" />}
    </div>
  );
}

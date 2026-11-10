import { useEffect, useState } from 'react';
import { BUTTON_OUTLINE, CARD } from '@/lib/ui';
import { clearSignedOutOffline, readSignedOutOffline } from '@/lib/signedOutNotice';

// A calm bar at the top of the landing page. Layout mounts it again on every arrival.
// It reads the flag on each arrival. The flag is read while rendering.
// It is cleared in an effect once the notice is on screen.
// A double render (StrictMode) gets the same answer so the notice is not lost.
export default function SignedOutNotice() {
  const [shown, setShown] = useState(() => readSignedOutOffline());
  useEffect(() => {
    if (shown) clearSignedOutOffline();
  }, [shown]);
  if (!shown) return null;

  function dismiss() {
    clearSignedOutOffline();
    setShown(false);
    // The button goes away, so focus goes to the start of the page and does not fall to the top of the document.
    document.getElementById('main')?.focus();
  }

  return (
    <div role="status" className={`${CARD} flex flex-col gap-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between`}>
      <p>
        Signed out on this device. We could not reach the server, so sign out again later if you are on a shared computer.
      </p>
      <button type="button" onClick={dismiss} className={`${BUTTON_OUTLINE} shrink-0 self-start sm:self-auto`}>
        Dismiss
      </button>
    </div>
  );
}

import { useState } from 'react';
import { apiPost, apiDelete } from '@/lib/api';
import ErrorNotice from '@/components/ErrorNotice';
import { BUTTON_OUTLINE } from '@/lib/ui';

// Each state names itself in full. "Save" and "Saved" would look the same to a test and to a
// screen reader at a glance. The words carry the state and the colour never does.
function labelFor(saved, busy) {
  if (busy) return saved ? 'Removing…' : 'Saving…';
  return saved ? 'Remove from saved' : 'Save guide';
}

// `initiallySaved` is read once. The guide page holds this button back until it knows the answer
// so the label never starts wrong and then flips.
// `onChange` is called with the new state once the server has agreed, so a list can drop the guide.
// `title` is the guide's name. It is added for a screen reader so a list of buttons does not read
// as the same words over and over. The visible label stays the start of the spoken one.
export default function SaveGuideButton({ guideId, initiallySaved, className = '', onChange, title }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // The page waits for the server. A button that switched first and rolled back on an error
  // would tell the reader something untrue. Campus wifi makes that common.
  async function toggle() {
    const removing = saved;
    setBusy(true);
    setError(null);
    try {
      if (removing) await apiDelete(`/guides/${guideId}/bookmark`);
      else await apiPost(`/guides/${guideId}/bookmark`);
      setSaved(!removing);
      onChange?.(!removing);
    } catch (err) {
      // A 404 on remove means it was already gone, for example from a second tab. The reader
      // wanted it gone, so that is a success. The same 404 on save is real: the guide is back
      // in review. So the answer depends on which request was made.
      if (removing && err.status === 404) { setSaved(false); onChange?.(false); }
      else setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      {/* The button sits straight on the page so its ring offset is the page colour. */}
      <button
        type="button"
        onClick={toggle}
        aria-disabled={busy || undefined}
        aria-busy={busy}
        className={`${BUTTON_OUTLINE} w-full focus-visible:ring-offset-canvas ${busy ? 'text-muted-foreground' : ''}`}
      >
        {labelFor(saved, busy)}
        {title && <span className="sr-only">{' '}{title}</span>}
      </button>
      {error && <ErrorNotice error={error} className="mt-2" />}
    </div>
  );
}

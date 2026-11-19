import { useRef, useState } from 'react';
import { apiPost, apiPostForm } from '@/lib/api';
import ErrorNotice from '@/components/ErrorNotice';
import RecordAttachment from '@/components/RecordAttachment';
import { todayIso } from '@/lib/dates';
import { CARD, FIELD, DATE_FIELD, BUTTON_PRIMARY } from '@/lib/ui';

const H2 = 'font-head text-base font-semibold leading-[1.3] text-ink';

// Add a line to the record. The owner and a legal expert the matter is shared with can both do it.
export default function LogStep({ matterId, onDone, canAttach = false }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // A second press before the first has finished is ignored: no second entry, no second file.
  const inFlight = useRef(false);

  async function save(event) {
    event.preventDefault();
    if (!text.trim()) {
      setError({ message: 'Write what happened before you add it to the record.' });
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (file) {
        // A file goes as a form. A note with no file stays plain JSON.
        const form = new FormData();
        form.append('description', text.trim());
        form.append('occurred_on', date);
        form.append('file', file);
        await apiPostForm(`/matters/${matterId}/events`, form);
      } else {
        await apiPost(`/matters/${matterId}/events`, { description: text.trim(), occurred_on: date });
      }
      setText('');
      setFile(null);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={CARD}>
      <h2 id="add-heading" className={H2}>Add to your record</h2>
      <label htmlFor="step-text" className="mt-3 block text-sm font-medium">What happened</label>
      <p id="step-hint" className="mt-1 text-sm text-muted-foreground">Free text can identify you. Avoid unnecessary sensitive details.</p>
      <textarea id="step-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-describedby="step-hint" className={FIELD} />
      <label htmlFor="step-date" className="mt-3 block text-sm font-medium">When</label>
      <input id="step-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className={DATE_FIELD} />
      {canAttach && <RecordAttachment file={file} onChange={setFile} disabled={busy} />}
      {error && <ErrorNotice error={error} className="mt-2" />}
      <button type="submit" aria-disabled={busy || undefined} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-4`}>
        Add to the record
      </button>
    </form>
  );
}


import { useMemo, useState } from 'react';
import DaySlots from '@/components/DaySlots';
import ErrorNotice from '@/components/ErrorNotice';
import { apiPut } from '@/lib/api';
import { toSaveBody, validateWindows } from '@/lib/hours';
import { slotsOf, windowsOf, changeCount } from '@/lib/daySlots';

// The lawyer's weekly consultation hours, edited on the Calendar. This container owns the draft and the save.
// It passes the calendar the draft windows, so the Open items move as slots change, and a dayExtra renderer
// that draws the slots of one day. A draft exists only once the hours have arrived, so Save cannot send an
// empty list by mistake. An empty save is still sent when the lawyer means to close bookings.
// `children` is called with { windows, dayExtra }. `now` is the page clock, so past slots are judged on it.
export default function ConsultationHours({ availability, error, loading, onSaved, items = [], now, children }) {
  // The reply of the last save. Until a save, the hours the page was given are the saved hours.
  const [saved, setSaved] = useState(null);
  // The open slots while the lawyer edits. Null means no edit, so the draft is the saved hours.
  const [edits, setEdits] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [notice, setNotice] = useState('');

  const base = saved ?? availability ?? null;
  const ready = base !== null;
  const savedSlots = useMemo(() => slotsOf(base?.windows ?? []), [base]);
  const draft = edits ?? savedSlots;
  const changes = changeCount(draft, savedSlots);
  const isDefault = Boolean(base?.is_default);
  const draftWindows = useMemo(() => windowsOf(draft), [draft]);

  const change = (next) => {
    setEdits(next);
    setNotice('');
  };

  const discard = () => {
    setEdits(null);
    setNotice('');
    setSaveError(null);
  };

  async function save() {
    if (busy || !ready) return;
    const body = toSaveBody(windowsOf(draft));
    const problem = validateWindows(body.windows);
    if (problem) {
      setSaveError({ message: problem });
      setNotice('');
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      const reply = await apiPut('/bookings/availability', body);
      setSaved(reply);
      setEdits(null);
      setNotice(reply.windows.length === 0
        ? 'Saved. Nobody can book you until you add hours.'
        : 'Saved. Students can book only inside these hours.');
      onSaved?.(reply);
    } catch (err) {
      setSaveError(err);
    } finally {
      setBusy(false);
    }
  }

  // Drawn by the calendar for the selected day. `key` makes a new day start with a closed copy panel.
  const dayExtra = ready
    ? (iso, { select, phone = false } = {}) => (
      <DaySlots
        key={iso}
        iso={iso}
        phone={phone}
        select={select}
        slots={draft}
        onChange={change}
        items={items}
        now={now}
        isDefault={isDefault}
        changes={changes}
        notice={notice}
        saveError={saveError}
        busy={busy}
        onSave={save}
        onDiscard={discard}
      />
    )
    : undefined;

  return (
    <>
      {!ready && error && <ErrorNotice error={error} className="mt-6" />}
      {!ready && !error && loading && <p className="mt-6 text-muted-foreground">Loading your hours…</p>}
      {children({ windows: draftWindows, dayExtra })}
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import ErrorNotice from '@/components/ErrorNotice';
import SlotPicker from '@/components/SlotPicker';
import { useApi } from '@/lib/useApi';
import { slotDays } from '@/lib/slots';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/lib/ui';

// Open times for one lawyer, for a choice of a new time. `onPick` gets the chosen moment as an ISO
// string. If it throws, the server's message is shown. A 409 means the time was just taken, so the
// open times are loaded again and the choice is cleared. Any other failure keeps the choice on screen.
// The panel takes focus when it opens.
export default function ChangeTime({ providerId, primaryLabel, onPick, onNeverMind, className = '' }) {
  const { data: payload, error: loadError, loading, refetch } = useApi(providerId ? `/bookings/slots/${providerId}` : '');
  const days = slotDays(payload);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const panel = useRef(null);

  useEffect(() => { panel.current?.focus(); }, []);

  const day = days.find((d) => d.date === date) ?? days[0];

  async function send() {
    if (busy || !time) return;
    setBusy(true);
    setError(null);
    try {
      await onPick(time);
    } catch (err) {
      setError(err);
      if (err?.status === 409) {
        setTime(null);
        refetch();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={panel} tabIndex={-1} role="group" aria-label="Choose another time" className={`rounded-control border border-border bg-chrome-raised p-3 outline-none ${className}`}>
      {loading && !payload && <p className="text-sm text-muted-foreground">Loading the open times…</p>}
      {loadError && <ErrorNotice error={loadError} />}
      {payload && days.length === 0 && (
        <p className="text-sm font-semibold text-ink">No open times in the next two weeks.</p>
      )}
      {days.length > 0 && (
        <SlotPicker
          days={days}
          date={day.date}
          time={time}
          onDate={(next) => { setDate(next); setTime(null); }}
          onTime={setTime}
        />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {days.length > 0 && (
          <button
            type="button"
            aria-disabled={busy || !time || undefined}
            aria-busy={busy || undefined}
            className={BUTTON_PRIMARY}
            onClick={send}
          >
            {busy ? 'Sending…' : primaryLabel}
          </button>
        )}
        <button type="button" className={BUTTON_OUTLINE} onClick={onNeverMind}>Never mind</button>
      </div>
      {error && <ErrorNotice error={error} className="mt-3" />}
    </div>
  );
}

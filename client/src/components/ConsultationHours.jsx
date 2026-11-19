import { useEffect, useRef, useState } from 'react';
import ErrorNotice from '@/components/ErrorNotice';
import { apiPut } from '@/lib/api';
import {
  MAX_WINDOWS, TIME_OPTIONS, END_OPTIONS, WEEKDAY_NAMES, newWindow, toDraft, toSaveBody, validateWindows,
} from '@/lib/hours';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, CARD, SELECT, RING } from '@/lib/ui';

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const REMOVE = `inline-flex min-h-touch items-center rounded-control px-3 text-sm font-semibold text-info hover:bg-chrome-raised ${RING}`;

// The lawyer's weekly consultation hours. The editor is made only once the hours have arrived, so its
// draft starts from the real hours. A save made before they arrived would otherwise close bookings.
export default function ConsultationHours({ availability, error, loading, onSaved }) {
  if (!availability) {
    if (error) return <ErrorNotice error={error} className="mt-6" />;
    return loading ? <p className="mt-6 text-muted-foreground">Loading your hours…</p> : null;
  }
  return <HoursEditor availability={availability} onSaved={onSaved} />;
}

// The server sends the standard hours until the lawyer saves, and an empty list once they have closed
// bookings on purpose. The draft is kept here until saved.
function HoursEditor({ availability, onSaved }) {
  const [rows, setRows] = useState(() => toDraft(availability.windows ?? []));
  const [isDefault, setIsDefault] = useState(Boolean(availability.is_default));
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [message, setMessage] = useState('');

  // The id of the control that takes focus after a window is added or removed, since the pressed one moves or goes.
  const focusAfter = useRef(null);
  useEffect(() => {
    if (focusAfter.current) {
      document.getElementById(focusAfter.current)?.focus();
      focusAfter.current = null;
    }
  }, [rows]);

  const edit = (key, field, value) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    setMessage('');
  };
  const add = (weekday) => {
    const row = newWindow(weekday);
    focusAfter.current = `hours-${row.key}-start`;
    setRows((rs) => [...rs, row]);
    setMessage('');
  };
  const remove = (key, weekday) => {
    focusAfter.current = `hours-add-${weekday}`;
    setRows((rs) => rs.filter((r) => r.key !== key));
    setMessage('');
  };

  async function save() {
    const body = toSaveBody(rows);
    const problem = validateWindows(body.windows);
    if (problem) {
      setSaveError({ message: problem });
      setMessage('');
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      const saved = await apiPut('/bookings/availability', body);
      setRows(toDraft(saved.windows));
      setIsDefault(Boolean(saved.is_default));
      setMessage(saved.windows.length === 0
        ? 'Saved. Nobody can book you until you add hours.'
        : 'Saved. Students can book only inside these hours.');
      onSaved?.(saved);
    } catch (err) {
      setSaveError(err);
    } finally {
      setBusy(false);
    }
  }

  const closed = !isDefault && rows.length === 0;
  const full = rows.length >= MAX_WINDOWS;

  return (
    <section aria-labelledby="hours-heading" className={`mt-6 ${CARD}`}>
      <h2 id="hours-heading" className="font-head text-lg text-ink">Your consultation hours</h2>
      <p className="mt-2 text-sm">
        Students can book only inside these hours. Each consultation is 30 minutes. Times are in Kigali time.
      </p>
      {isDefault && (
        <p className="mt-2 text-sm font-semibold text-ink">
          These are the standard hours. Students can already book inside them. Change them and save, or save to keep them.
        </p>
      )}
      {closed && (
        <p className="mt-2 text-sm font-semibold text-ink">
          You have no open hours. Nobody can book you until you add hours.
        </p>
      )}

      <div className="mt-4 space-y-5">
        {DAYS.map((weekday) => {
          const dayRows = rows.filter((r) => r.weekday === weekday);
          const name = WEEKDAY_NAMES[weekday];
          return (
            <div key={weekday}>
              <h3 className="text-sm font-semibold text-ink">{name}</h3>
              {dayRows.length === 0 && <p className="mt-1 text-sm text-muted-foreground">No hours</p>}
              <ul className="mt-2 space-y-3">
                {dayRows.map((row, index) => {
                  const n = index + 1;
                  const startId = `hours-${row.key}-start`;
                  const endId = `hours-${row.key}-end`;
                  return (
                    <li key={row.key} className="flex flex-wrap items-end gap-3">
                      <label htmlFor={startId} className="text-sm font-semibold">
                        Start<span className="sr-only"> on {name}, window {n}</span>
                        <select id={startId} value={row.start} onChange={(e) => edit(row.key, 'start', e.target.value)} className={`${SELECT} sm:w-40`}>
                          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                      <label htmlFor={endId} className="text-sm font-semibold">
                        End<span className="sr-only"> on {name}, window {n}</span>
                        <select id={endId} value={row.end} onChange={(e) => edit(row.key, 'end', e.target.value)} className={`${SELECT} sm:w-40`}>
                          {END_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                      <button type="button" onClick={() => remove(row.key, weekday)} className={REMOVE}>
                        Remove{' '}<span className="sr-only">window {n} on {name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                id={`hours-add-${weekday}`}
                aria-disabled={full || undefined}
                onClick={() => { if (!full) add(weekday); }}
                className={`${BUTTON_OUTLINE} mt-2`}
              >
                Add hours{' '}<span className="sr-only">on {name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {full && <p className="mt-3 text-sm text-muted-foreground">You have reached the most windows allowed, {MAX_WINDOWS}.</p>}

      <div className="mt-5">
        <button
          type="button"
          aria-disabled={busy || undefined}
          onClick={save}
          className={`${BUTTON_PRIMARY} w-full sm:w-auto`}
        >
          {busy ? 'Saving…' : 'Save consultation hours'}
        </button>
      </div>
      <p role="status" aria-live="polite" className={message ? 'mt-3 text-sm font-semibold text-ink' : ''}>{message}</p>
      {saveError && <ErrorNotice error={saveError} className="mt-3" />}
    </section>
  );
}

import { useId, useState } from 'react';
import ErrorNotice from '@/components/ErrorNotice';
import { usePanelFocus } from '@/lib/panelFocus';
import { addDays, longDay, shortWeekDay } from '@/lib/schedule';
import { WEEKDAY_NAMES } from '@/lib/hours';
import { todayIso, kigaliTime } from '@/lib/dates';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_TEXT, CHIP, CHIP_ON, RING } from '@/lib/ui';
import {
  DEFAULT_START, DEFAULT_END, hhmm, parseHhmm, weekdayOf, toggleSlot, openRange, closeDay, copyDay,
  visibleMinutes, groupMinutes, slotLabel, isPastSlot, consultsOnDay, slotStateOf, openMinutes,
} from '@/lib/daySlots';

// The slots of one day, drawn inside the Calendar's day panel and above the phone agenda.
// The draft belongs to ConsultationHours. This block only shows it and changes it through onChange.
const STATE_LOOK = {
  open: { word: 'Open', tile: 'border border-primary bg-primary-subtle text-ink', wordTone: 'text-primary-text' },
  closed: { word: 'Closed', tile: 'border border-control bg-surface text-ink', wordTone: 'text-muted-foreground' },
  booked: { word: 'Booked', tile: 'border border-inverse bg-inverse text-inverse-foreground', wordTone: 'text-inverse-foreground' },
  requested: { word: 'Requested', tile: 'border-2 border-dashed border-primary bg-surface text-ink', wordTone: 'text-primary-text' },
  past: { word: 'Past', tile: 'border border-chrome-raised bg-chrome-raised text-muted-foreground', wordTone: 'text-muted-foreground' },
};
const TILE = `flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-control px-3 py-2 text-left ${RING}`;
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function DaySlots({
  iso, phone = false, select, slots, onChange, items = [], now, isDefault, changes, notice, saveError, busy, onSave, onDiscard,
}) {
  const id = useId();
  const weekday = weekdayOf(iso);
  const name = WEEKDAY_NAMES[weekday];
  const [showAll, setShowAll] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [targets, setTargets] = useState([]);
  const { firstRef, openerRef } = usePanelFocus(copyOpen);

  const consults = consultsOnDay(items, iso);
  const minutes = visibleMinutes(slots, weekday, { showAll, must: [...consults.keys()] });
  // All 48 slots are shown without the button being pressed when something open sits outside 06:00 to 22:00.
  const forced = !showAll && minutes.length === 48;
  const today = todayIso(now);
  const nowMinute = parseHhmm(kigaliTime(now) ?? '00:00');
  const dayOpen = new Set(openMinutes(slots, weekday));
  const others = ALL_DAYS.filter((d) => d !== weekday);
  const headingId = `${id}-heading`;
  const copyId = `${id}-copy`;
  const copyLabel = `${id}-copy-label`;

  // A booked or requested slot is not a toggle. It moves focus to its row in the list.
  const jumpTo = (key) => {
    const rows = [...document.querySelectorAll(`[data-anchor="${key}"]`)];
    const row = rows.find((el) => el.getClientRects().length > 0) ?? rows[0];
    row?.scrollIntoView?.({ block: 'center' });
    row?.focus();
  };

  const pressSlot = (minute, state, consult) => {
    if (state === 'booked' || state === 'requested') return jumpTo(consult.key);
    if (state === 'past') return undefined;
    return onChange(toggleSlot(slots, weekday, minute));
  };

  const toggleTarget = (day) => setTargets((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day]));
  const copy = () => {
    if (targets.length === 0) return;
    onChange(copyDay(slots, weekday, targets));
    setTargets([]);
    setCopyOpen(false);
  };

  const statusText = changes > 0
    ? `Not saved yet. ${changes} ${changes === 1 ? 'change' : 'changes'}.`
    : notice;
  // Save shows for an edit, and also for the standard hours, which are kept only when the lawyer saves them.
  const canSave = changes > 0 || isDefault;
  const barOn = canSave || Boolean(notice);

  return (
    <section aria-labelledby={headingId} className="mt-6 border-t border-border-soft pt-6">
      {phone && (
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => select(addDays(iso, -1))} className={BUTTON_OUTLINE}>Previous day</button>
          <span className="text-center text-sm font-semibold text-ink">{shortWeekDay(iso)}</span>
          <button type="button" onClick={() => select(addDays(iso, 1))} className={BUTTON_OUTLINE}>Next day</button>
        </div>
      )}
      <h3 id={headingId} className="mt-4 font-head text-lg text-ink md:sr-only">{longDay(iso)}: your slots</h3>
      <p aria-hidden="true" className="mt-4 hidden font-head text-lg text-ink md:block">Your slots</p>
      <p className="mt-1 text-sm text-muted-foreground">Changes apply to every {name}.</p>
      <p className="mt-1 text-sm text-muted-foreground">Students can book only open slots. Each slot is 30 minutes. Times are in Kigali time.</p>
      {isDefault && (
        <p className="mt-2 text-sm font-semibold text-ink">
          These are the standard hours. Students can already book inside them. Change them and save, or save to keep them.
        </p>
      )}
      {slots.size === 0 && (
        <p className="mt-2 text-sm font-semibold text-ink">Nothing is open. Students cannot book you until you open some slots.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange(openRange(slots, weekday, DEFAULT_START, DEFAULT_END))} className={BUTTON_OUTLINE}>
          Open 09:00 to 17:00
        </button>
        <button type="button" onClick={() => onChange(closeDay(slots, weekday))} className={BUTTON_OUTLINE}>
          Close the whole day
        </button>
        <button
          type="button"
          ref={openerRef}
          aria-expanded={copyOpen}
          aria-controls={copyId}
          onClick={() => setCopyOpen((open) => !open)}
          className={BUTTON_OUTLINE}
        >
          Copy this day to other weekdays
        </button>
      </div>

      {copyOpen && (
        <div id={copyId} role="group" aria-labelledby={copyLabel} className="mt-3 border-t border-border-soft pt-3">
          <p id={copyLabel} className="text-sm font-semibold text-ink">Copy the open slots of {name} to</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {others.map((day, index) => {
              const on = targets.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  ref={index === 0 ? firstRef : undefined}
                  aria-pressed={on}
                  onClick={() => toggleTarget(day)}
                  className={`${CHIP} ${on ? CHIP_ON : ''}`}
                >
                  {WEEKDAY_NAMES[day]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Copying replaces the open slots on the chosen days.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" aria-disabled={targets.length === 0 || undefined} onClick={copy} className={BUTTON_PRIMARY}>
              Copy
            </button>
            <button type="button" onClick={() => setCopyOpen(false)} className={BUTTON_TEXT}>Cancel</button>
            {targets.length === 0 && <p className="text-sm text-muted-foreground">Choose at least one day.</p>}
          </div>
        </div>
      )}

      <div className="mt-5 space-y-5">
        {groupMinutes(minutes).map((group) => {
          const groupId = `${id}-${group.key}`;
          return (
            <div key={group.key} role="group" aria-labelledby={groupId}>
              <h4 id={groupId} className="text-sm font-semibold text-ink">
                {group.label}{' '}
                <span className="font-normal text-muted-foreground">{hhmm(group.from)} to {hhmm(group.to)}</span>
              </h4>
              <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-6">
                {group.minutes.map((minute) => {
                  const consult = consults.get(minute);
                  const past = isPastSlot(iso, minute, today, nowMinute);
                  const state = slotStateOf({ open: dayOpen.has(minute), past, consult });
                  const look = STATE_LOOK[state];
                  const toggles = state === 'open' || state === 'closed';
                  const label = toggles
                    ? slotLabel(weekday, minute, state)
                    : `${slotLabel(weekday, minute, look.word.toLowerCase())}${consult ? '. Go to the consultation.' : ''}`;
                  return (
                    <button
                      key={minute}
                      type="button"
                      aria-label={label}
                      aria-pressed={toggles ? state === 'open' : undefined}
                      aria-disabled={state === 'past' || undefined}
                      onClick={() => pressSlot(minute, state, consult)}
                      className={`${TILE} ${look.tile}`}
                    >
                      <span className="text-2xl font-semibold leading-none tabular-nums">{hhmm(minute)}</span>
                      <span className={`text-sm font-semibold ${look.wordTone}`}>{look.word}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {forced && <p className="mt-3 text-sm text-muted-foreground">Hours outside 06:00 to 22:00 are open or booked, so all hours show.</p>}
      {!forced && (
        <button type="button" aria-pressed={showAll} onClick={() => setShowAll((on) => !on)} className={`${BUTTON_TEXT} mt-3`}>
          {showAll ? 'Show 06:00 to 22:00 only' : 'Show all hours'}
        </button>
      )}

      {saveError && <ErrorNotice error={saveError} className="mt-4" />}

      <div className={`sticky bottom-0 z-10 mt-5 flex flex-wrap items-center gap-3 bg-surface ${barOn ? 'border-t border-border py-3' : ''}`}>
        <p role="status" className="mr-auto text-sm font-semibold text-ink">{statusText}</p>
        {canSave && (
          <button type="button" aria-disabled={busy || undefined} onClick={onSave} className={BUTTON_PRIMARY}>
            {busy ? 'Saving…' : 'Save hours'}
          </button>
        )}
        {changes > 0 && <button type="button" onClick={onDiscard} className={BUTTON_OUTLINE}>Discard changes</button>}
      </div>
    </section>
  );
}

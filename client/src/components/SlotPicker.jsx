import { KIGALI_NOTE } from '@/lib/slots';
import { CHIP, CHIP_ON } from '@/lib/ui';

// The date and time choice for a consultation. `days` comes from slotDays (lib/slots.js). The date
// chosen is `date` and the time is the ISO moment `time`. Both are held by the page, which sends `time`.
// Each button is a native button, so the keyboard reaches it, and its state is aria-pressed.
export default function SlotPicker({ days, date, time, onDate, onTime, describedBy, groupRef }) {
  const day = days.find((d) => d.date === date) ?? days[0];
  const countWords = (n) => `${n} ${n === 1 ? 'time' : 'times'} open`;

  return (
    <div ref={groupRef} tabIndex={-1} className="mt-4 outline-none">
      <fieldset>
        <legend className="text-sm font-semibold">Choose a date</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {days.map((d) => {
            const on = d.date === day.date;
            return (
              <button
                key={d.date}
                type="button"
                aria-pressed={on}
                onClick={() => onDate(d.date)}
                className={`${on ? CHIP_ON : CHIP} h-auto flex-col items-start py-2`}
              >
                <span>{d.label}</span>{' '}
                <span className="text-sm font-normal text-muted-foreground">{countWords(d.count)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset aria-describedby={describedBy} className="mt-5">
        <legend className="text-sm font-semibold">Choose a time</legend>
        <p className="mt-1 text-sm text-muted-foreground">{KIGALI_NOTE}</p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {day.times.map((t) => {
            const on = t.iso === time;
            return (
              <button
                key={t.iso}
                type="button"
                aria-pressed={on}
                onClick={() => onTime(t.iso)}
                className={`${on ? CHIP_ON : CHIP} justify-center`}
              >
                {t.time}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

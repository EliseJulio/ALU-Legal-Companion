import { useState } from 'react';
import ChangeTime from '@/components/ChangeTime';
import ErrorNotice from '@/components/ErrorNotice';
import { canChangeTime } from '@/lib/bookings';
import { usePanelFocus } from '@/lib/panelFocus';
import { kigaliSlotLabel } from '@/lib/slots';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/lib/ui';

// The time the lawyer suggested, with the two answers. `onAnswer` gets 'accept' or 'decline'.
function SuggestedTime({ slot, onAnswer, className }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const when = kigaliSlotLabel(slot) ?? 'another time';

  async function answer(action) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAnswer(action);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="group" aria-label="The lawyer suggested another time" className={`rounded-control border border-border bg-primary-subtle p-3 ${className}`}>
      <p className="text-sm font-semibold text-ink">The lawyer suggested another time: {when}.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" aria-disabled={busy || undefined} className={BUTTON_PRIMARY} onClick={() => answer('accept')}>
          Accept this time
        </button>
        <button type="button" aria-disabled={busy || undefined} className={BUTTON_OUTLINE} onClick={() => answer('decline')}>
          No thanks
        </button>
      </div>
      {error && <ErrorNotice error={error} className="mt-2" />}
    </div>
  );
}

// The person's own move to another time. Once it is sent the panel says so and the list is loaded again.
function MoveTime({ booking, move, onChanged, className }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  // Closing with Never mind returns focus to the Change the time button.
  const { openerRef } = usePanelFocus(open);

  if (done) {
    return <p role="status" className={`text-sm font-semibold text-ink ${className}`}>Time changed. The lawyer will confirm the new time.</p>;
  }
  if (!open) {
    return (
      <div className={className}>
        <button ref={openerRef} type="button" className={BUTTON_OUTLINE} onClick={() => setOpen(true)}>Change the time</button>
      </div>
    );
  }
  return (
    <div className={className}>
      <ChangeTime
        providerId={booking.provider_id}
        primaryLabel="Move to this time"
        onPick={async (iso) => {
          await move(iso);
          setDone(true);
          setOpen(false);
          onChanged?.();
        }}
        onNeverMind={() => setOpen(false)}
      />
    </div>
  );
}

// Both actions for one consultation a signed-in or anonymous person can see. The page passes `answer(action)`
// and `move(iso)`, which send the request for that kind of booking. `onChanged` reloads the booking.
export default function TimeActions({ booking, answer, move, onChanged, className = '' }) {
  return (
    <>
      {booking.proposed_slot && (
        <SuggestedTime
          slot={booking.proposed_slot}
          className={className}
          onAnswer={async (action) => {
            await answer(action);
            onChanged?.();
          }}
        />
      )}
      {canChangeTime(booking) && booking.provider_id && (
        <MoveTime booking={booking} move={move} onChanged={onChanged} className={className} />
      )}
    </>
  );
}

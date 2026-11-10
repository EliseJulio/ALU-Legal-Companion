import { useEffect, useRef, useState } from 'react';
import ErrorNotice from '@/components/ErrorNotice';
import { ScheduleMark } from '@/components/ScheduleItem';
import { apiPost } from '@/lib/api';
import { readableSlot } from '@/lib/bookings';
import JoinCallLink from '@/components/JoinCallLink';
import { BUTTON_DISABLED, BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/lib/ui';

// What a lawyer can do next with a consultation. It only moves forward.
// A decline always asks first, so it is shown below as a question and not as a button here.
const NEXT = {
  requested: [['accepted', 'Accept this time', true], ['declined', 'Decline', false]],
  accepted: [['completed', 'Mark as completed', true], ['declined', 'Decline', false]],
};

// What the page says after an action, so a screen reader hears the result.
const DONE = {
  accepted: (when) => `Accepted. ${when} is confirmed.`,
  declined: (when) => `Declined. ${when} has been taken off your requests.`,
  completed: (when) => `Marked as completed for ${when}.`,
};

// One consultation on the lawyer's calendar, in the day list and the agenda. The circle and the state
// word come first, then the requester exactly as the server sent it. An anonymous request says
// "Anonymous requester" and that text is never changed here. The meeting and the actions follow.
export default function ExpertConsultRow({ item, onDone }) {
  const booking = item.booking;
  const when = readableSlot(booking.slot) ?? 'this time';
  // A request whose time has gone cannot be taken any more. It is shown as Past, with Accept off.
  const lapsed = booking.status === 'requested' && item.mark === 'past';
  const actions = NEXT[booking.status] ?? [];

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const declineRef = useRef(null);
  const keepRef = useRef(null);

  // The question opens with focus on the safe choice. Closing it returns focus to Decline.
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  function closeConfirm() {
    setConfirming(false);
    declineRef.current?.focus();
  }

  async function move(status) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage('');
    setConfirming(false);
    try {
      await apiPost(`/bookings/${booking.id}/status`, { status });
      setMessage(DONE[status]?.(when) ?? '');
      onDone();
    } catch (err) {
      // For example "you already have an accepted booking at that time".
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  // The button for one action. Accept is off for a lapsed request. A busy button reads as busy.
  function actionButton([status, label, primary]) {
    if (status === 'declined') {
      return (
        <button
          key={status}
          ref={declineRef}
          type="button"
          aria-disabled={busy || undefined}
          aria-busy={busy || undefined}
          className={BUTTON_OUTLINE}
          onClick={() => setConfirming(true)}
        >
          <span>{label}{' '}<span className="sr-only">for {when}</span></span>
        </button>
      );
    }
    const off = lapsed && status === 'accepted';
    return (
      <button
        key={status}
        type="button"
        aria-disabled={off || busy || undefined}
        aria-busy={busy || undefined}
        className={off ? BUTTON_DISABLED : primary ? BUTTON_PRIMARY : BUTTON_OUTLINE}
        onClick={() => { if (!off) move(status); }}
      >
        <span>{label}{' '}<span className="sr-only">for {when}</span></span>
      </button>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="mt-1.5">
        <ScheduleMark mark={item.mark} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tabular-nums text-ink">
          {item.word}{item.time ? ` · ${item.time}` : ''}
        </p>
        <dl className="mt-1 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Requested by</dt>
          <dd className="break-words font-medium">{booking.requester}</dd>
          {booking.topic && (<><dt className="text-muted-foreground">About</dt><dd className="break-words">{booking.topic}</dd></>)}
        </dl>

        {booking.status === 'accepted' && <JoinCallLink booking={booking} className="mt-2" />}

        {lapsed && (
          <p className="mt-2 text-sm text-muted-foreground">
            This time has passed, so it cannot be accepted. Decline it to close the request.
          </p>
        )}

        {confirming ? (
          <div role="group" aria-label={`Decline the request for ${when}`} className="mt-3 rounded-control border border-border bg-chrome-raised p-3">
            <p className="text-sm font-semibold text-ink">Decline the request for {when}?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" aria-disabled={busy || undefined} className={BUTTON_PRIMARY} onClick={() => move('declined')}>
                Decline this time
              </button>
              <button ref={keepRef} type="button" className={BUTTON_OUTLINE} onClick={closeConfirm}>
                Keep the request
              </button>
            </div>
          </div>
        ) : (
          actions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">{actions.map(actionButton)}</div>
          )
        )}

        {/* Always in the page, so a change to it is announced. Empty when there is nothing to say. */}
        <p role="status" aria-live="polite" className={message ? 'mt-2 text-sm font-semibold text-ink' : ''}>{message}</p>
        {error && <ErrorNotice error={error} className="mt-2" />}
      </div>
    </div>
  );
}

// The scheduled work: deadline reminders, consultation reminders and the retention purge.
// The timer in index.js, the protected job route and the cron script all run this one function,
// so none of them can leave a part out.
import { runDueReminders } from './reminders.js';
import { runDueBookingReminders } from './bookingReminders.js';
import { purgeExpired } from './retention.js';

export async function runDueJobs() {
  const reminders = await runDueReminders();
  const booking_reminders = await runDueBookingReminders();
  const retention = await purgeExpired();
  return { reminders, booking_reminders, retention };
}

const TEN_MINUTES = 10 * 60 * 1000;

// Runs the jobs every ten minutes in this process. Every pass takes its own lock, so running often is
// safe. The timer does not keep the process alive on its own.
export function startJobScheduler({ everyMs = TEN_MINUTES } = {}) {
  const tick = () => {
    runDueJobs()
      .then((r) => {
        const busy = r.reminders.sent || r.reminders.missed || r.reminders.failed
          || r.booking_reminders.sent || r.booking_reminders.missed || r.booking_reminders.failed
          || r.retention.questions || r.retention.bookings;
        if (busy) console.log('[jobs]', r);
      })
      .catch((err) => console.error('[jobs] pass failed', { error: err.code || err.name }));
  };
  tick();
  const handle = setInterval(tick, everyMs);
  handle.unref?.();
  return handle;
}

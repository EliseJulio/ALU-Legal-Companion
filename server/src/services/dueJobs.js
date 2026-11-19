// The scheduled work: deadline reminders, consultation reminders and the retention purge.
// The timer in index.js, the protected job route and the cron script all run this one function,
// so none of them can leave a part out.
import { runDueReminders } from './reminders.js';
import { runDueBookingReminders } from './bookingReminders.js';
import { purgeExpired } from './retention.js';

// Each job runs on its own, so one that fails does not stop the others. A failed job has no entry in
// the result and adds one to errors. Only the error name or code is logged.
export async function runDueJobs() {
  const result = {};
  let errors = 0;
  const jobs = [
    ['reminders', runDueReminders],
    ['booking_reminders', runDueBookingReminders],
    ['retention', purgeExpired],
  ];
  for (const [name, job] of jobs) {
    try {
      result[name] = await job();
    } catch (err) {
      errors += 1;
      console.error('[jobs] job failed', { job: name, error: err.code || err.name });
    }
  }
  return { ...result, errors };
}

const TEN_MINUTES = 10 * 60 * 1000;

// Runs the jobs every ten minutes in this process. Every pass takes its own lock, so running often is
// safe. The timer does not keep the process alive on its own.
export function startJobScheduler({ everyMs = TEN_MINUTES } = {}) {
  const tick = () => {
    runDueJobs()
      .then((r) => {
        const busy = r.errors || r.reminders?.sent || r.reminders?.missed || r.reminders?.failed
          || r.booking_reminders?.sent || r.booking_reminders?.missed || r.booking_reminders?.failed
          || r.retention?.questions || r.retention?.bookings;
        if (busy) console.log('[jobs]', r);
      })
      .catch((err) => console.error('[jobs] pass failed', { error: err.code || err.name }));
  };
  tick();
  const handle = setInterval(tick, everyMs);
  handle.unref?.();
  return handle;
}

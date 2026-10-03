// ALU Legal Companion API: server entry point
import app from './app.js';
import { getSecret } from './middleware/auth.js';
import { startReminderScheduler } from './services/reminders.js';

// Stop at startup if JWT_SECRET is missing or weak. This is better than failing at the first login.
try {
  getSecret();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const port = process.env.PORT || 4000;
// REMINDERS=off turns the scheduler off, for when a cron job runs `npm run reminders` instead.
if (process.env.REMINDERS !== 'off') startReminderScheduler();
app.listen(port, () => console.log(`ALU Legal Companion API on :${port}`));

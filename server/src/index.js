// ALU Legal Companion API server entry point
import app from './app.js';
import { getSecret } from './middleware/auth.js';
import { isRealTransport } from './services/mailer.js';
import { startJobScheduler } from './services/dueJobs.js';
import { callConfigured } from './services/callTickets.js';

// Stop at startup if JWT_SECRET is missing or weak. Otherwise anyone could make their own admin token.
try {
  getSecret();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

// Say in one line when mail is in dev mode, so nobody has to guess whether a link was sent.
const notes = [
  isRealTransport() ? null : 'mail in dev mode: no SMTP_URL, links are printed to this log',
  callConfigured() ? null : 'calls: the platform call is not set up, Daily or Meet will be used',
].filter(Boolean);

// Runs the due reminders and the retention purge every ten minutes. REMINDERS=off turns this off when
// a separate cron job runs "npm run reminders" instead. This way two processes never send the same reminder.
if (process.env.REMINDERS !== 'off') startJobScheduler();

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`ALU Legal Companion API on :${port}${notes.length ? ` (${notes.join('; ')})` : ''}`));

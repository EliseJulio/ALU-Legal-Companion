// ALU Legal Companion API server entry point
import app from './app.js';
import { pool } from './db.js';
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

// Email links are built from APP_URL. In production a missing address would put localhost in every link.
if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) {
  console.error('APP_URL must be set in production. Email links are built from it.');
  process.exit(1);
}

// Say in one line when mail is in dev mode, so nobody has to guess whether a link was sent.
const notes = [
  isRealTransport() ? null : 'mail in dev mode: no SMTP_URL, links are printed to this log',
  callConfigured() ? null : 'calls: the platform call is not set up, Daily or Meet will be used',
].filter(Boolean);

// Runs the due reminders and the retention purge every ten minutes. REMINDERS=off turns this off when
// a separate cron job runs "npm run reminders" instead. This way two processes never send the same reminder.
const scheduler = process.env.REMINDERS !== 'off' ? startJobScheduler() : null;

const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`ALU Legal Companion API on :${port}${notes.length ? ` (${notes.join('; ')})` : ''}`));

// On SIGTERM or SIGINT: stop the job timer, stop taking new connections, let running requests finish,
// close the database pool and exit. After 10 seconds the process exits anyway.
let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`${signal} received, shutting down`);
  const hardStop = setTimeout(() => {
    console.error('Shutdown took too long, exiting');
    process.exit(1);
  }, 10_000);
  if (scheduler) clearInterval(scheduler);
  server.close(async () => {
    try {
      await pool.end();
    } catch (err) {
      console.error('[db] pool close failed', { name: err.name });
    }
    clearTimeout(hardStop);
    process.exit(0);
  });
  server.closeIdleConnections?.();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

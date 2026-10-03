// One pass of the reminder scheduler for a cron job: `npm run reminders`.
// Prints what happened and exits. Set REMINDERS=off on the API server if you use this instead.
import { runDueReminders } from './services/reminders.js';
import { pool } from './db.js';

const result = await runDueReminders();
console.log('reminders:', result);
await pool.end();

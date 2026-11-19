// One pass of the scheduled jobs for a cron job. Usage: npm run reminders
// It runs the deadline reminders, the consultation reminders and the retention purge, prints what
// happened and exits. Set REMINDERS=off on the API server if you use this instead.
import { runDueJobs } from './services/dueJobs.js';
import { pool } from './db.js';

const result = await runDueJobs();
console.log('jobs:', result);
await pool.end();

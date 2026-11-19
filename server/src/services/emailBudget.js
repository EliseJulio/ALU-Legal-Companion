// The daily limit on outgoing email. The mail provider allows about 200 messages a day.
// Essential mail always goes out and is counted. Optional mail stops once the day's budget is used.
import { q } from '../db.js';
import { kigaliToday } from './kigali.js';

export const EMAIL_BUDGET_CODE = 'EMAIL_BUDGET';
const DEFAULT_BUDGET = 180;

// Read at call time so a change to the setting applies without a restart in tests.
// A value that is not a whole number falls back to the default.
export function dailyBudget() {
  const raw = (process.env.DAILY_EMAIL_BUDGET ?? '').trim();
  if (raw === '') return DEFAULT_BUDGET;
  return /^\d+$/.test(raw) ? Number(raw) : DEFAULT_BUDGET;
}

// The error an optional send raises when the day's budget is used up. It holds no address.
export function budgetReachedError() {
  const err = new Error('The daily email budget has been reached. Optional mail is skipped until tomorrow.');
  err.code = EMAIL_BUDGET_CODE;
  return err;
}

// How many sends are counted for a Kigali day.
export async function sendsOn(day = kigaliToday()) {
  const [row] = await q('SELECT count FROM email_sends WHERE day = $1', [day]);
  return row ? row.count : 0;
}

// Counts one send. Essential mail is counted this way and is never refused.
export async function countSend(day = kigaliToday()) {
  const [row] = await q(
    `INSERT INTO email_sends (day, count) VALUES ($1, 1)
     ON CONFLICT (day) DO UPDATE SET count = email_sends.count + 1
     RETURNING count`,
    [day],
  );
  return row.count;
}

// Takes one place in today's budget for optional mail, if one is left. The check and the count
// are a single statement, so two requests cannot both take the last place.
export async function reserveOptionalSend(day = kigaliToday()) {
  const budget = dailyBudget();
  if (budget < 1) return false;
  const rows = await q(
    `INSERT INTO email_sends (day, count) VALUES ($1, 1)
     ON CONFLICT (day) DO UPDATE SET count = email_sends.count + 1
       WHERE email_sends.count < $2
     RETURNING count`,
    [day, budget],
  );
  return rows.length === 1;
}

// Gives back a place that was reserved for a send that did not happen.
export async function releaseSend(day = kigaliToday()) {
  await q('UPDATE email_sends SET count = count - 1 WHERE day = $1 AND count > 0', [day]);
}

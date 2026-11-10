// Numbers for the lawyer and admin overviews. Counts and averages only, never a person.
import { q } from '../db.js';
import { ANSWER_TARGET_DAYS } from '../config/targets.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// The moment before which an open question counts as overdue. A question asked exactly
// ANSWER_TARGET_DAYS ago is not overdue yet. It is overdue only once it is older than that.
export function overdueCutoff(now = new Date()) {
  return new Date(now.getTime() - ANSWER_TARGET_DAYS * DAY_MS);
}

// How many open questions are overdue.
export async function countOverdue(now = new Date()) {
  const [row] = await q(
    `SELECT count(*)::int AS n FROM questions WHERE status = 'open' AND created_at < $1::timestamptz`,
    [overdueCutoff(now).toISOString()]);
  return row.n;
}

// The Monday (UTC) of the week that holds `now`, as a Date at 00:00 UTC.
export function weekStartOf(now = new Date()) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS);
}

const isoDay = (d) => d.toISOString().slice(0, 10);

// The last `count` weeks (Monday to Sunday in UTC) with the oldest first and ending with the current week.
// Each week has the questions asked and the bookings requested. A week with nothing has zeros.
export async function weeklyCounts(now = new Date(), count = 8) {
  const last = weekStartOf(now);
  const first = new Date(last.getTime() - (count - 1) * 7 * DAY_MS);
  const countBy = async (table) => {
    const rows = await q(
      `SELECT to_char(date_trunc('week', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS week, count(*)::int AS n
         FROM ${table} WHERE created_at >= $1::timestamptz GROUP BY 1`,
      [first.toISOString()]);
    return new Map(rows.map((r) => [r.week, r.n]));
  };
  const [questions, bookings] = [await countBy('questions'), await countBy('bookings')];
  return Array.from({ length: count }, (_, i) => {
    const week = isoDay(new Date(first.getTime() + i * 7 * DAY_MS));
    return { week_start: week, questions: questions.get(week) ?? 0, bookings: bookings.get(week) ?? 0 };
  });
}

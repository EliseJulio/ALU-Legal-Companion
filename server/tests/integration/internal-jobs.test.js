import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { scheduleReminders, kigaliToday, addDays } from '../../src/services/reminders.js';
import { resetDb, makeUser, makeMatter, makeProvider } from '../helpers.js';

const URL = '/api/internal/run-jobs';
const SECRET = 'j'.repeat(40);

let savedSecret;
beforeEach(async () => {
  await resetDb();
  savedSecret = process.env.JOB_SECRET;
  process.env.JOB_SECRET = SECRET;
});
afterEach(() => {
  process.env.JOB_SECRET = savedSecret;
});

describe('POST /api/internal/run-jobs', () => {
  it('answers 401 when the secret header is missing', async () => {
    const res = await request(app).post(URL);
    expect(res.status).toBe(401);
    expect(typeof res.body.error).toBe('string');
  });

  it('answers 401 for a wrong secret of the same length', async () => {
    const res = await request(app).post(URL).set('X-Job-Secret', 'k'.repeat(40));
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('answers 401 for a wrong secret of a different length', async () => {
    const res = await request(app).post(URL).set('X-Job-Secret', 'nope');
    expect(res.status).toBe(401);
  });

  it('answers 404, like an unknown path, when JOB_SECRET is shorter than 32 characters', async () => {
    process.env.JOB_SECRET = 'j'.repeat(31);
    const res = await request(app).post(URL).set('X-Job-Secret', 'j'.repeat(31));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('answers 404 when JOB_SECRET is empty or missing', async () => {
    process.env.JOB_SECRET = '';
    expect((await request(app).post(URL).set('X-Job-Secret', '')).status).toBe(404);
    delete process.env.JOB_SECRET;
    expect((await request(app).post(URL).set('X-Job-Secret', 'anything')).status).toBe(404);
  });

  it('runs the reminders and the retention purge with the right secret and returns counts only', async () => {
    const student = await makeUser('student', 'due-student@alustudent.com');
    const matter = await makeMatter(student.user.id, { title: 'Eviction by my landlord' });
    // A deadline three days away: the reminder for two days' time is not due, the one for today is.
    await scheduleReminders(matter.id, addDays(kigaliToday(), 3));

    const res = await request(app).post(URL).set('X-Job-Secret', SECRET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      reminders: { sent: 1, failed: 0, cancelled: 0, missed: 0 },
      booking_reminders: { sent: 0, failed: 0, missed: 0, cancelled: 0, skipped: false },
      retention: { questions: 0, bookings: 0 },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/@|Eviction/);
    const [row] = await q(`SELECT status FROM reminders WHERE matter_id = $1 AND send_on = $2`,
      [matter.id, kigaliToday()]);
    expect(row.status).toBe('sent');
  });
});

describe('requests with the wrong secret', () => {
  it('do not spend the budget, so a flood of them cannot stop the real job', async () => {
    process.env.RATE_LIMIT_TEST = '1';
    try {
      for (let i = 0; i < 40; i += 1) {
        expect((await request(app).post(URL).set('X-Job-Secret', 'nope')).status).toBe(401);
      }
      expect((await request(app).post(URL).set('X-Job-Secret', SECRET)).status).toBe(200);
    } finally {
      delete process.env.RATE_LIMIT_TEST;
    }
  });
});

describe('the cron entry (npm run reminders)', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const runner = path.resolve(here, '..', '..', 'src', 'run-reminders.js');

  it('sends a due consultation reminder as well as a deadline reminder', async () => {
    const owner = await makeUser('student', 'cron-owner@alustudent.com');
    const expert = await makeUser('legal_expert', 'cron-expert@example.org');
    const provider = await makeProvider({ user_id: expert.user.id }, { verifiedBy: expert.user.id });
    const now = Date.now();
    const [booking] = await q(
      `INSERT INTO bookings (user_id, provider_id, slot, status) VALUES ($1,$2,$3,'accepted') RETURNING id`,
      [owner.user.id, provider.id, new Date(now + 2 * 60 * 60 * 1000)]);
    await q(`INSERT INTO booking_reminders (booking_id, recipient, kind, send_at) VALUES ($1,'owner','hour',$2)`,
      [booking.id, new Date(now - 60 * 1000)]);

    const child = spawnSync(process.execPath, [runner], {
      encoding: 'utf8',
      timeout: 60000,
      env: { ...process.env, REMINDERS: 'off' },
    });

    expect(child.status).toBe(0);
    expect(child.stdout).toMatch(/booking_reminders/);
    const [row] = await q('SELECT status FROM booking_reminders WHERE booking_id = $1', [booking.id]);
    expect(row.status).toBe('sent');
  });
});

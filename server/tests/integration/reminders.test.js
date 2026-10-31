import { jest } from '@jest/globals';
import { q } from '../../src/db.js';
import { scheduleReminders, runDueReminders, addDays } from '../../src/services/reminders.js';
import { resetDb, makeUser, makeMatter } from '../helpers.js';

const TODAY = '2026-10-10';
const inDays = (n) => addDays(TODAY, n);

let owner;
let matter;
let mails;
beforeEach(async () => {
  await resetDb();
  owner = await makeUser('student', 'owner@alustudent.com');
  matter = await makeMatter(owner.user.id, { title: 'Harassment by my supervisor' });
  mails = [];
  jest.spyOn(console, 'log').mockImplementation((text) => { mails.push(String(text)); });
});
afterEach(() => { jest.restoreAllMocks(); });

const rows = (id = matter.id) => q(
  'SELECT due_on, send_on, status, sent_at FROM reminders WHERE matter_id = $1 ORDER BY send_on, id', [id]);

describe('scheduleReminders', () => {
  it('makes a reminder seven days and one day before the deadline', async () => {
    await scheduleReminders(matter.id, inDays(20), TODAY);
    expect((await rows()).map((r) => [r.send_on, r.status])).toEqual([
      [inDays(13), 'pending'], [inDays(19), 'pending']]);
  });

  it('moves a send date that is already past to today', async () => {
    await scheduleReminders(matter.id, inDays(5), TODAY);
    expect((await rows()).map((r) => r.send_on)).toEqual([TODAY, inDays(4)]);
  });

  it('makes one reminder when both dates would be today', async () => {
    const made = await scheduleReminders(matter.id, inDays(1), TODAY);
    expect(made).toHaveLength(1);
    expect((await rows())[0].send_on).toBe(TODAY);
  });

  it('makes one reminder for a deadline that is today', async () => {
    await scheduleReminders(matter.id, TODAY, TODAY);
    expect(await rows()).toHaveLength(1);
  });

  it('makes nothing for a deadline that has passed', async () => {
    expect(await scheduleReminders(matter.id, inDays(-1), TODAY)).toEqual([]);
    expect(await rows()).toEqual([]);
  });

  it('cancels the pending reminders when the deadline is cleared', async () => {
    await scheduleReminders(matter.id, inDays(20), TODAY);
    expect(await scheduleReminders(matter.id, null, TODAY)).toEqual([]);
    expect((await rows()).map((r) => r.status)).toEqual(['cancelled', 'cancelled']);
  });

  it('cancels the old ones and makes new ones when the deadline changes', async () => {
    await scheduleReminders(matter.id, inDays(20), TODAY);
    await scheduleReminders(matter.id, inDays(40), TODAY);
    const statuses = (await rows()).map((r) => r.status);
    expect(statuses.filter((s) => s === 'cancelled')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'pending')).toHaveLength(2);
  });

  it('leaves a reminder that was already sent alone', async () => {
    await scheduleReminders(matter.id, inDays(20), TODAY);
    await q(`UPDATE reminders SET status = 'sent', sent_at = now() WHERE send_on = $1`, [inDays(13)]);
    await scheduleReminders(matter.id, inDays(40), TODAY);
    const all = await rows();
    expect(all.filter((r) => r.status === 'sent')).toHaveLength(1);
    expect(all.filter((r) => r.status === 'pending')).toHaveLength(2);
  });
});

describe('runDueReminders', () => {
  it('sends a due reminder once and marks it sent', async () => {
    await scheduleReminders(matter.id, inDays(3), TODAY);
    const first = await runDueReminders(TODAY);
    expect(first).toEqual({ sent: 1, failed: 0, cancelled: 0, missed: 0 });
    expect(mails).toHaveLength(1);
    expect(mails[0]).toContain('To:      owner@alustudent.com');
    const [sent] = (await rows()).filter((r) => r.status === 'sent');
    expect(sent.sent_at).not.toBeNull();

    const second = await runDueReminders(TODAY);
    expect(second.sent).toBe(0);
    expect(mails).toHaveLength(1);
  });

  it('does not send a reminder before its day', async () => {
    await scheduleReminders(matter.id, inDays(20), TODAY);
    const result = await runDueReminders(TODAY);
    expect(result.sent).toBe(0);
    expect(mails).toHaveLength(0);
  });

  it('sends the later reminder on its own day', async () => {
    await scheduleReminders(matter.id, inDays(20), TODAY);
    await runDueReminders(inDays(13));
    await runDueReminders(inDays(19));
    expect(mails).toHaveLength(2);
    expect(mails[0]).toContain('in 7 days');
    expect(mails[1]).toContain('tomorrow');
  });

  it('says today on the day of the deadline', async () => {
    await scheduleReminders(matter.id, TODAY, TODAY);
    await runDueReminders(TODAY);
    expect(mails[0]).toContain('is today, on');
  });

  it('gives the date and a link but never the title of the matter', async () => {
    await scheduleReminders(matter.id, inDays(3), TODAY);
    await runDueReminders(TODAY);
    expect(mails[0]).toContain(inDays(3));
    expect(mails[0]).toContain('/matters');
    expect(mails[0]).toContain('Hello Test student');
    expect(mails[0]).not.toContain('Harassment');
    expect(mails[0]).not.toContain('supervisor');
  });

  it('marks a reminder missed when its deadline has already passed and sends nothing', async () => {
    await q(`INSERT INTO reminders (matter_id, due_on, send_on) VALUES ($1,$2,$3)`,
      [matter.id, inDays(-2), inDays(-9)]);
    const result = await runDueReminders(TODAY);
    expect(result).toMatchObject({ sent: 0, missed: 1 });
    expect(mails).toHaveLength(0);
    expect((await rows())[0].status).toBe('missed');
  });

  it('cancels the reminder of a matter that was closed', async () => {
    await scheduleReminders(matter.id, inDays(3), TODAY);
    await q(`UPDATE matters SET status = 'closed' WHERE id = $1`, [matter.id]);
    const result = await runDueReminders(TODAY);
    expect(result.cancelled).toBeGreaterThan(0);
    expect(mails).toHaveLength(0);
    expect((await rows()).some((r) => r.status === 'sent')).toBe(false);
  });

  it('cancels the reminder of an account that was switched off', async () => {
    await scheduleReminders(matter.id, inDays(3), TODAY);
    await q('UPDATE users SET deactivated_at = now() WHERE id = $1', [owner.user.id]);
    const result = await runDueReminders(TODAY);
    expect(result.cancelled).toBeGreaterThan(0);
    expect(mails).toHaveLength(0);
  });

  it('keeps a reminder pending when the email cannot be sent and tries again next time', async () => {
    await scheduleReminders(matter.id, inDays(3), TODAY);
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.SMTP_URL = 'smtp://127.0.0.1:1';
    try {
      const failed = await runDueReminders(TODAY);
      expect(failed).toMatchObject({ sent: 0, failed: 1 });
      expect((await rows()).some((r) => r.status === 'sent')).toBe(false);
      expect(JSON.stringify(errors.mock.calls)).not.toContain('owner@alustudent.com');
    } finally {
      process.env.SMTP_URL = '';
    }
    const retry = await runDueReminders(TODAY);
    expect(retry.sent).toBe(1);
  });
});

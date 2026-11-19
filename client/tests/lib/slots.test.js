import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { kigaliTime, slotDays, KIGALI_NOTE } from '@/lib/slots';

describe('times are shown in Kigali time, whatever zone the browser is in', () => {
  // The test process is moved to Los Angeles time, so a clock read in the browser's own zone would
  // show a different hour. Node reads a change to TZ while it runs.
  let savedZone;
  beforeAll(() => {
    savedZone = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
  });
  afterAll(() => {
    if (savedZone === undefined) delete process.env.TZ;
    else process.env.TZ = savedZone;
  });

  // Intl keeps the zone it started with, so the clock is built again on load and its options are checked.
  it('asks Intl for the Africa/Kigali zone by name, and reads 07:00 UTC as 09:00 while the process is on another zone', async () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    vi.resetModules();
    await import('@/lib/slots');
    const named = spy.mock.calls.some(([, options]) => options?.timeZone === 'Africa/Kigali');
    spy.mockRestore();
    expect(named).toBe(true);
    expect(new Date('2099-01-01T07:00:00.000Z').getHours()).not.toBe(9);
    expect(kigaliTime('2099-01-01T07:00:00.000Z')).toBe('09:00');
    expect(kigaliTime('2099-01-01T23:30:00.000Z')).toBe('01:30');
  });
});

describe('the dates the server returns, ready to show', () => {
  const payload = {
    days: [
      { date: '2026-11-06', slots: ['2026-11-06T07:00:00.000Z', '2026-11-06T07:30:00.000Z'] },
      { date: '2026-11-05', slots: ['2026-11-05T13:00:00.000Z'] },
      { date: '2026-11-07', slots: [] },
      { date: '2026-11-08', slots: ['not a time'] },
    ],
  };

  it('keeps only days with a time to book, in date order, with a weekday label, a count and each time’s Kigali clock', () => {
    const days = slotDays(payload);
    expect(days.map((d) => d.date)).toEqual(['2026-11-05', '2026-11-06']);
    const [first, second] = days;
    expect(first).toMatchObject({ date: '2026-11-05', label: 'Thursday 5 November', count: 1 });
    expect(second).toMatchObject({ date: '2026-11-06', label: 'Friday 6 November', count: 2 });
    expect(second.times).toEqual([
      { iso: '2026-11-06T07:00:00.000Z', time: '09:00' },
      { iso: '2026-11-06T07:30:00.000Z', time: '09:30' },
    ]);
  });
});

describe('nothing is invented for times that cannot be read', () => {
  it('gives no clock for an unreadable time, no days for an empty or missing payload, and says the zone in words', () => {
    expect(kigaliTime('not a time')).toBeNull();
    expect(slotDays({ days: [] })).toEqual([]);
    expect(slotDays(null)).toEqual([]);
    expect(slotDays({})).toEqual([]);
    expect(KIGALI_NOTE).toBe('Times are in Kigali time (UTC+2).');
  });
});

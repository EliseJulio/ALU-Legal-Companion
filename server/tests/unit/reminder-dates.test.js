import { kigaliToday, isDateString, addDays, REMINDER_OFFSETS } from '../../src/services/reminders.js';

describe('kigaliToday', () => {
  it('is the same day until 22:00 UTC', () => {
    expect(kigaliToday(new Date('2026-09-21T21:59:00Z'))).toBe('2026-09-21');
  });

  it('is the next day from 22:00 UTC because Kigali is two hours ahead', () => {
    expect(kigaliToday(new Date('2026-09-21T22:00:00Z'))).toBe('2026-09-22');
  });

  it('crosses a month and a year', () => {
    expect(kigaliToday(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01');
    expect(kigaliToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });

  it('returns a plain date string', () => {
    expect(kigaliToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isDateString', () => {
  it('accepts real dates including a leap day', () => {
    expect(isDateString('2026-09-21')).toBe(true);
    expect(isDateString('2028-02-29')).toBe(true);
  });

  it('refuses dates that do not exist', () => {
    for (const bad of ['2026-02-30', '2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31']) {
      expect(isDateString(bad)).toBe(false);
    }
  });

  it('refuses anything that is not written as YYYY-MM-DD', () => {
    for (const bad of ['2026-9-1', '21-09-2026', '2026/09/21', '2026-09-21T00:00:00Z', ' 2026-09-21', '', null, undefined, 20260921, {}]) {
      expect(isDateString(bad)).toBe(false);
    }
  });
});

describe('addDays', () => {
  it('adds and takes away days', () => {
    expect(addDays('2026-09-21', 7)).toBe('2026-09-28');
    expect(addDays('2026-09-21', -7)).toBe('2026-09-14');
    expect(addDays('2026-09-21', 0)).toBe('2026-09-21');
  });

  it('crosses a month and a year and a leap day', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('is not moved by the time zone of the machine', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
  });
});

describe('REMINDER_OFFSETS', () => {
  it('sends a reminder seven days and one day before', () => {
    expect(REMINDER_OFFSETS).toEqual([7, 1]);
  });
});

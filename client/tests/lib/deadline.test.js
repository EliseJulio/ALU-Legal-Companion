import { describe, it, expect } from 'vitest';
import { daysUntil, dueInWords, todayIso } from '@/lib/dates';

// A fixed "today" so the answers do not change from day to day.
const TODAY = new Date(2026, 9, 10);

describe('daysUntil', () => {
  it('counts the days to a date', () => {
    expect(daysUntil('2026-10-10', TODAY)).toBe(0);
    expect(daysUntil('2026-10-11', TODAY)).toBe(1);
    expect(daysUntil('2026-10-17', TODAY)).toBe(7);
    expect(daysUntil('2026-10-09', TODAY)).toBe(-1);
  });

  it('counts across a month and a year', () => {
    expect(daysUntil('2026-11-09', TODAY)).toBe(30);
    expect(daysUntil('2027-01-01', TODAY)).toBe(83);
  });

  it('gives nothing for text that is not a date', () => {
    for (const bad of ['', 'soon', '2026-10-10T10:00:00Z', null, undefined]) {
      expect(daysUntil(bad, TODAY)).toBeNull();
    }
  });
});

describe('dueInWords', () => {
  it('says it the way a person would', () => {
    expect(dueInWords('2026-10-10', TODAY)).toBe('today');
    expect(dueInWords('2026-10-11', TODAY)).toBe('tomorrow');
    expect(dueInWords('2026-10-09', TODAY)).toBe('yesterday');
    expect(dueInWords('2026-10-16', TODAY)).toBe('in 6 days');
    expect(dueInWords('2026-10-05', TODAY)).toBe('5 days ago');
  });

  it('gives nothing for text that is not a date', () => {
    expect(dueInWords('nope', TODAY)).toBeNull();
  });
});

describe('todayIso', () => {
  it('writes a date as year, month and day with two digits each', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

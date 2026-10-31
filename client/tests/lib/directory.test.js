import { describe, it, expect } from 'vitest';
import { readableDays, typeLabel, CATEGORIES, PROVIDER_TYPES } from '@/lib/directory';
import { readableDay, readableDate } from '@/lib/dates';

describe('readableDays', () => {
  it('says days for a short time', () => {
    expect(readableDays(30)).toBe('30 days');
    expect(readableDays(1)).toBe('1 day');
  });

  it('says years for whole years', () => {
    expect(readableDays(365)).toBe('1 year');
    expect(readableDays(730)).toBe('2 years');
  });

  it('gives nothing for a value that is not a deadline', () => {
    for (const bad of [0, -5, 1.5, null, undefined, 'abc']) {
      expect(readableDays(bad)).toBeNull();
    }
  });
});

describe('typeLabel', () => {
  it('gives words for a known code', () => {
    expect(typeLabel('maj_office')).toBe('Legal aid office (MAJ)');
  });

  it('falls back to plain words for an unknown code', () => {
    expect(typeLabel('something_new')).toBe('Legal help');
  });

  it('has a label for every type and no code is shown raw', () => {
    for (const { value, label } of PROVIDER_TYPES) {
      expect(label).not.toMatch(/_/);
      expect(typeLabel(value)).toBe(label);
    }
  });
});

describe('CATEGORIES', () => {
  it('are the three groups of the directory', () => {
    expect(CATEGORIES.map((c) => c.value)).toEqual(['lawyer', 'consultant', 'organisation']);
  });
});

describe('readableDay', () => {
  it('prints a calendar date without moving it', () => {
    const text = readableDay('2026-10-03');
    expect(text).toMatch(/October/);
    expect(text).toMatch(/\b3\b/);
    expect(text).toMatch(/2026/);
  });

  it('gives nothing for text that is not a date', () => {
    for (const bad of ['', 'tomorrow', '2026-10-03T10:00:00Z', null, undefined]) {
      expect(readableDay(bad)).toBeNull();
    }
  });
});

describe('readableDate', () => {
  it('prints a timestamp', () => {
    expect(readableDate('2026-09-01T10:00:00Z')).toMatch(/2026/);
  });

  it('gives nothing for a missing or broken value', () => {
    for (const bad of ['', 'not a date', null, undefined, 0]) {
      expect(readableDate(bad)).toBeNull();
    }
  });
});

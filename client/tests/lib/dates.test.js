import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kigaliDay, readableDate } from '@/lib/dates';

describe('kigaliDay', () => {
  it('gives the Kigali calendar day near midnight, which is the next day in UTC', () => {
    // 22:30 UTC on 18 November is 00:30 on 19 November in Kigali (UTC+2).
    expect(kigaliDay('2026-11-18T22:30:00Z')).toBe('2026-11-19');
    expect(kigaliDay('not a time')).toBeNull();
  });
});

describe('readableDate in the Kigali zone', () => {
  let savedZone;
  beforeAll(() => { savedZone = process.env.TZ; process.env.TZ = 'America/Los_Angeles'; });
  afterAll(() => {
    if (savedZone === undefined) delete process.env.TZ;
    else process.env.TZ = savedZone;
  });

  it('gives the Kigali day at the midnight edge', () => {
    expect(readableDate('2026-11-05T21:59:00Z')).toBe('5 November 2026');
    expect(readableDate('2026-11-05T22:30:00Z')).toBe('6 November 2026');
  });
});

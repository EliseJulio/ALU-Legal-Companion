import { describe, it, expect } from 'vitest';
import { kigaliDay } from '@/lib/dates';

describe('kigaliDay', () => {
  it('gives the Kigali calendar day near midnight, which is the next day in UTC', () => {
    // 22:30 UTC on 18 November is 00:30 on 19 November in Kigali (UTC+2).
    expect(kigaliDay('2026-11-18T22:30:00Z')).toBe('2026-11-19');
    expect(kigaliDay('not a time')).toBeNull();
  });
});

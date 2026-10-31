import { describe, it, expect } from 'vitest';
import { readableSlot, bookingStatusStep } from '@/lib/bookings';

describe('readableSlot', () => {
  it('prints a time with the date and the weekday', () => {
    const text = readableSlot('2027-03-01T10:00:00.000Z');
    expect(text).toMatch(/2027/);
    expect(text).toMatch(/March/);
  });

  it('gives nothing for an unreadable value', () => {
    expect(readableSlot('not a time')).toBeNull();
    expect(readableSlot(undefined)).toBeNull();
  });
});

describe('bookingStatusStep', () => {
  it('has a sentence for every status the database allows', () => {
    for (const status of ['requested', 'accepted', 'declined', 'completed']) {
      expect(bookingStatusStep(status).heading).not.toMatch(/cannot explain/);
    }
  });

  it('offers another lawyer only when the booking is over', () => {
    expect(bookingStatusStep('requested').next).toBeNull();
    expect(bookingStatusStep('accepted').next).toBeNull();
    expect(bookingStatusStep('declined').next).toMatch(/directory/);
    expect(bookingStatusStep('completed').next).toMatch(/directory/);
  });

  it('says plainly when it does not know the status', () => {
    const step = bookingStatusStep('something_new');
    expect(step.heading).toMatch(/cannot explain/);
    expect(step.body).toMatch(/unconfirmed/);
  });
});

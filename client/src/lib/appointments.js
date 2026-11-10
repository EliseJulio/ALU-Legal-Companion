// What a booking looks like on a calendar and who can join it. No React here, so the rules can be
// tested on their own. A consultation request is a booking, so a student's requests and their
// accepted times share one list.
import { secureAddress } from '@/lib/url';

export const ACCEPTED = 'accepted';
export const REQUESTED = 'requested';
export const PAST = 'past';
export const DECLINED = 'declined';
export const OTHER = 'other';

const pad = (n) => String(n).padStart(2, '0');

// The reader's own calendar day of a booking slot, as 'YYYY-MM-DD'. A slot is an exact moment sent
// as UTC. Its day is the day in the reader's zone, the same zone readableSlot prints it in. Null
// for a slot that cannot be read.
export function localDay(raw) {
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return null;
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
}

// The time of a slot in the reader's zone, as 'HH:MM'. Null for a slot that cannot be read.
export function timeOf(raw) {
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return null;
  return `${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

// The state of a booking and the word for it. A requested or declined booking keeps its state.
// An accepted one moves to Past once its time has gone by.
// A status this page has never heard of is shown as it is in grey.
export function bookingState(booking, now = new Date()) {
  switch (booking.status) {
    case REQUESTED: return { state: REQUESTED, word: 'Requested' };
    case DECLINED: return { state: DECLINED, word: 'Declined' };
    case 'completed': return { state: PAST, word: 'Past' };
    case ACCEPTED: {
      const when = new Date(booking.slot);
      const passed = !Number.isNaN(when.getTime()) && when < now;
      return passed ? { state: PAST, word: 'Past' } : { state: ACCEPTED, word: 'Accepted' };
    }
    default: return { state: OTHER, word: 'Status not known' };
  }
}

// The video room a person may join. Only an accepted booking has one.
// The stored address must be a full https address (lib/url.js). Anything else gives null.
// Every place a room is shown uses this one rule so they cannot drift apart.
export function roomFor(booking) {
  if (!booking || booking.status !== ACCEPTED) return null;
  return secureAddress(booking.meet_link);
}

// An accepted booking can always be joined. The join page decides what happens next.
export const canJoin = (booking) => Boolean(booking) && booking.status === ACCEPTED;

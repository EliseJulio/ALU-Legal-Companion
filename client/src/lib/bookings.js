import { apiPost } from '@/lib/api';
import { KIGALI_ZONE } from '@/lib/dates';

// A booking slot is an exact moment. The server sends it as UTC such as
// '2027-03-01T10:00:00.000Z'. Printed raw it would show the wrong hour for someone in Kigali.
// So it is always shown in Kigali time, whatever zone the browser is in. My activity uses the same function.
export function readableSlot(raw) {
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: KIGALI_ZONE,
  });
}

// What each status means, as a sentence. A bare word such as "requested" or "declined" does
// not tell the reader whether to wait. `next` is set where the booking is over.
const STATUS_STEPS = {
  requested: {
    heading: 'Waiting for the lawyer to reply',
    body: 'Your request has reached them and nobody has answered yet. You do not need to send it again.',
    next: null,
  },
  accepted: {
    heading: 'The lawyer agreed to this time',
    body: 'Be ready at the time below. Bring anything written about the problem such as a contract, a payslip or messages.',
    next: null,
  },
  declined: {
    heading: 'This time was not taken',
    body: 'The lawyer could not take this slot. That says nothing about your problem.',
    next: 'Ask another lawyer in the directory',
  },
  cancelled: {
    heading: 'This consultation was cancelled',
    body: 'Nobody will attend this time. You can ask for another time.',
    next: 'Book another time in the directory',
  },
  completed: {
    heading: 'This appointment is finished',
    body: 'If something is still open you can arrange another time.',
    next: 'Book another time in the directory',
  },
};

// A status this page has never heard of. It says so and does not guess.
const UNKNOWN_STEP = {
  heading: 'This booking is in a state we cannot explain',
  body: 'Treat the time below as unconfirmed.',
  next: 'Arrange a time you can rely on in the directory',
};

export function bookingStatusStep(status) {
  return STATUS_STEPS[status] ?? UNKNOWN_STEP;
}

// A request or an accepted time can be cancelled while its time is still to come. Anything over cannot.
export function canCancel(booking, now = new Date()) {
  if (!booking || (booking.status !== 'requested' && booking.status !== 'accepted')) return false;
  const when = new Date(booking.slot);
  return !Number.isNaN(when.getTime()) && when.getTime() > now.getTime();
}

// Cancels a signed-in person's own booking. The login is sent.
export function cancelOwnBooking(id) {
  return apiPost(`/bookings/${id}/cancel`);
}

// Reads an anonymous booking from its code. The code is sent in the body only, never in the address,
// and no login is sent. The server answers with the same booking the old address-based read did.
export function lookUpAnonBooking(code) {
  return apiPost('/bookings/anon/status', { code }, { anonymous: true });
}

// Cancels an anonymous booking. The code travels in the body only, never in the address, and no login is sent.
export function cancelAnonBooking(code) {
  return apiPost('/bookings/anon/cancel', { anon_token: code }, { anonymous: true });
}

// A time can be moved while it is still to come and the request is open or accepted. Same rule as cancel.
export function canChangeTime(booking, now = new Date()) {
  return canCancel(booking, now);
}

// The lawyer suggests another time for a request (a login is sent).
export function proposeTime(id, slot) {
  return apiPost(`/bookings/${id}/propose`, { slot });
}

// The person accepts or declines the time the lawyer suggested (a login is sent).
export function answerProposal(id, action) {
  return apiPost(`/bookings/${id}/proposal`, { action });
}

// The anonymous person accepts or declines a suggested time. The code is sent in the body only.
export function answerProposalAnon(code, action) {
  return apiPost('/bookings/anon/proposal', { anon_token: code, action }, { anonymous: true });
}

// The person moves their own consultation to another open time (a login is sent).
export function rescheduleBooking(id, slot) {
  return apiPost(`/bookings/${id}/reschedule`, { slot });
}

// The anonymous person moves their consultation. The code is sent in the body only.
export function rescheduleBookingAnon(code, slot) {
  return apiPost('/bookings/anon/reschedule', { anon_token: code, slot }, { anonymous: true });
}

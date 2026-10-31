// A booking slot is an exact moment. The server sends it as UTC such as
// '2027-03-01T10:00:00.000Z'. Printed raw it would show the wrong hour for someone in Kigali.
// So it is shown in the reader's own zone. My activity uses the same function.
export function readableSlot(raw) {
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
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

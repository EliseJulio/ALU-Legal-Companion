// Pure rules for the step forms. A rule returns a message or nothing.
// No React here so each rule can be tested on its own.
// The server stays the final check. These only stop an obvious mistake before a request is made. They name the field.

export const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

// Returns the errors for one step as { fieldId: message }. The keys keep their order, which is the
// order the fields appear on the page. The first key is the one that takes focus.
export function collect(checks) {
  const errors = {};
  for (const [id, message] of checks) {
    if (message && !(id in errors)) errors[id] = message;
  }
  return errors;
}

export const requiredText = (value, message) => (isBlank(value) ? message : '');

// An https link. Empty is fine: the caller decides whether the link is required.
export function httpsLink(value, message = 'Start the link with https:// and paste the whole address.') {
  if (isBlank(value)) return '';
  return /^https:\/\/\S+\.\S+$/.test(String(value).trim()) ? '' : message;
}

// A Google Meet room. The page shows it as a link, so only this host is allowed.
export function meetLink(value) {
  if (isBlank(value)) return '';
  return /^https:\/\/meet\.google\.com\/\S+$/.test(String(value).trim())
    ? ''
    : 'Use a Google Meet link that starts with https://meet.google.com/';
}

export function digits(value, message = 'Use numbers only, for example 30.') {
  if (isBlank(value)) return '';
  return /^\d+$/.test(String(value).trim()) ? '' : message;
}

export function keyName(value) {
  if (isBlank(value)) return '';
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(value).trim())
    ? ''
    : 'Use lower case letters, numbers and dashes, for example car-purchase.';
}

// Returns the first id that has an error in page order. It returns null when there is none.
export function firstErrorId(errors) {
  const keys = Object.keys(errors || {});
  return keys.length ? keys[0] : null;
}

export function countErrors(errors) {
  return Object.keys(errors || {}).length;
}

// The words for a step's state. Words first, colour second. The stepper shows "Needs attention"
// under a step that was left unfinished; the other words are for the button's name (stepStatusWord).
export function stepWord(state) {
  return { complete: 'Complete', error: 'Needs attention', current: 'Current step', upcoming: 'Not started' }[state];
}

// The words a step button says for its state: done or in progress or to do or needs attention.
// The circle shows the same state in colour and shape. The words are what a screen reader hears.
export function stepStatusWord(state) {
  return { complete: 'done', current: 'in progress', upcoming: 'to do', error: 'needs attention' }[state];
}

// The accessible name of a step button such as "1 Basics, needs attention".
// It starts with the number and the label exactly as they are drawn.
// So a person who says what they see ("click Law and sources") matches the name (WCAG 2.5.3).
// The state follows after the comma.
export function stepAriaLabel(label, state, number) {
  return `${number} ${label}, ${stepStatusWord(state)}`;
}

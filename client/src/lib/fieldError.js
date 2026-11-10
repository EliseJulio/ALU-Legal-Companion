import { useState } from 'react';

// A form message that belongs to one box. `field` is the box's id. The message sits in an
// ErrorNotice with id FORM_ERROR_ID, so the box can point at it with aria-describedby.
export const FORM_ERROR_ID = 'form-error';

// A problem found on the page, before anything is sent. The page then calls focusField.
export function fieldProblem(field, message) {
  return { message, field };
}

// Moves focus to the box at fault so a keyboard or screen reader user lands on it.
export function focusField(field) {
  document.getElementById(field)?.focus();
}

// The attributes a box gets while the current error is about it. A server error has no field,
// so no box is marked and the alert alone is shown.
export function invalidProps(error, field) {
  return error?.field === field
    ? { 'aria-invalid': true, 'aria-describedby': FORM_ERROR_ID }
    : {};
}

// invalidProps for a form that keeps its alert on screen while the person fixes the box. Once a
// box named by the current error is edited it stops being marked invalid, because the mark would
// no longer be true. The alert text stays until the next submit, which makes a new error and so
// marks the box again if it is still wrong. `edited(field)` goes in the box's onChange.
export function useFieldMarks(error) {
  const [fixed, setFixed] = useState({ error: null, field: null });
  const edited = (field) => {
    if (error?.field === field && !(fixed.error === error && fixed.field === field)) setFixed({ error, field });
  };
  const marks = (field) => (fixed.error === error && fixed.field === field ? {} : invalidProps(error, field));
  return { marks, edited };
}

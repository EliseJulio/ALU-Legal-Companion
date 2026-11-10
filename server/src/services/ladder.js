// Checks for one step of the dispute ladder. The admin types the text, so every field is limited.
// The text is shown as it is written, so there is no markup to strip. Nothing here decides the law.

export const LADDER_FIELDS = ['position', 'title', 'tagline', 'description', 'law_cited'];

const LIMITS = { title: 120, tagline: 120, description: 1000, law_cited: 200 };

// Trims a text value. A missing value becomes an empty text. Anything else is kept so the
// check below refuses it.
export function cleanText(value) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value.trim() : value;
}

// Returns a message for the first problem found. It returns null when there is none.
// It checks the merged step, so a partial edit is checked as the step it would become.
export function ladderError(step) {
  if (!Number.isInteger(step.position) || step.position < 1 || step.position > 99) {
    return 'position must be a whole number from 1 to 99';
  }
  if (typeof step.title !== 'string' || step.title === '') return 'title is required';
  for (const field of ['title', 'tagline', 'description', 'law_cited']) {
    const value = step[field];
    if (typeof value !== 'string') return `${field} must be text`;
    if (value.length > LIMITS[field]) return `${field} must be ${LIMITS[field]} characters or fewer`;
  }
  return null;
}

// The position as a whole number. Text such as "3" is accepted because a form sends text.
export function positionFrom(value) {
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return value;
}

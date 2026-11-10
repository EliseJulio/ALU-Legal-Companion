// Words and small helpers for reports of a problem. The server stores the short codes.

export const REPORT_TYPES = [
  { value: 'info', label: 'Wrong or out-of-date information' },
  { value: 'office', label: 'A wrong office or number' },
  { value: 'broken', label: 'Something is broken' },
  { value: 'safety', label: 'A safety or abuse concern' },
  { value: 'idea', label: 'A suggestion' },
];

export const typeName = (value) => REPORT_TYPES.find((t) => t.value === value)?.label ?? value;

// The status words, in the order a report moves through them.
export const REPORT_STATUSES = [
  { value: 'received', label: 'Received' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

// Reads ?about=guide:12 or route:3 or provider:5 or a path such as /my-matters.
// Returns { kind, id, path } or null when it is not one of those.
export function parseAbout(value) {
  const text = String(value ?? '').trim();
  const m = /^(guide|route|provider):(\d{1,9})$/.exec(text);
  if (m) return { kind: m[1], id: Number(m[2]) };
  if (/^\/[\w\-./]{0,120}$/.test(text) && !text.startsWith('//')) return { kind: 'page', path: text };
  return null;
}

// The API path that gives the title of the thing a report is about.
export function aboutLookupPath(about) {
  if (about?.kind === 'guide') return `/guides/${about.id}`;
  if (about?.kind === 'route') return `/directory/routes/${about.id}`;
  if (about?.kind === 'provider') return `/directory/providers/${about.id}`;
  return null;
}

const KIND_WORDS = { guide: 'Guide', route: 'Matter', provider: 'Directory', page: 'Page' };
export const aboutText = (kind, title) => (kind && title ? `${KIND_WORDS[kind]}: ${title}` : '');

// The link a page puts at its foot: /report?about=guide:12
export const reportLink = (kind, id) => `/report?about=${kind}:${id}`;

// Mirrors the server. Case and spaces and hyphens do not matter and the LC- may be left out.
// It returns the code in its exact form. When the text cannot be a code it returns the trimmed text and the server then says no.
export function formatCode(input) {
  let cleaned = String(input ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('LC')) cleaned = cleaned.slice(2);
  cleaned = cleaned.replace(/O/g, '0').replace(/[IL]/g, '1');
  if (!/^[0-9A-HJKMNP-TV-Z]{8}$/.test(cleaned)) return String(input ?? '').trim();
  return `LC-${cleaned}`;
}

// "3 Nov" from a timestamp. It gives '' when the timestamp is missing or unreadable.
export function shortDay(raw) {
  const when = new Date(raw ?? '');
  if (!raw || Number.isNaN(when.getTime())) return '';
  return when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

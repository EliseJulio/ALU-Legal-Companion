// Words for the directory in one place. The database holds short codes. A reader should never
// see a code such as "maj_office" on the screen.
export const CATEGORIES = [
  { value: 'lawyer', label: 'Lawyers' },
  { value: 'consultant', label: 'Consultants' },
  { value: 'organisation', label: 'Organisations' },
];

export const PROVIDER_TYPES = [
  { value: 'pro_bono_lawyer', label: 'Pro-bono lawyer' },
  { value: 'maj_office', label: 'Legal aid office (MAJ)' },
  { value: 'labour_inspector', label: 'Labour inspector' },
  { value: 'abunzi', label: 'Abunzi mediation committee' },
  { value: 'isange', label: 'Isange One Stop Centre' },
  { value: 'investigation', label: 'Investigation bureau (RIB)' },
  { value: 'immigration', label: 'Immigration' },
  { value: 'business_registry', label: 'Business registration' },
  { value: 'legal_aid', label: 'Legal aid organisation' },
  { value: 'ombudsman', label: 'Ombudsman' },
  { value: 'human_rights', label: 'Human rights commission' },
  { value: 'other', label: 'Legal help' },
];

export function typeLabel(value) {
  return PROVIDER_TYPES.find((t) => t.value === value)?.label ?? 'Legal help';
}

// A deadline said the way a person would say it. 730 days is two years in the labour law and
// "730 days" would make the reader reach for a calculator.
export function readableDays(days) {
  const n = Number(days);
  if (!Number.isInteger(n) || n <= 0) return null;
  if (n % 365 === 0) return n === 365 ? '1 year' : `${n / 365} years`;
  return n === 1 ? '1 day' : `${n} days`;
}

// The five areas of law the guides cover. The database and the server have the same list.
export const DOMAINS = [
  { value: 'tenancy', label: 'Renting' },
  { value: 'employment', label: 'Work' },
  { value: 'business', label: 'Business' },
  { value: 'immigration', label: 'Immigration' },
  { value: 'harassment', label: 'Harassment' },
];

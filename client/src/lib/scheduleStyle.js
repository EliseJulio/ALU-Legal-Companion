import { TONE_CHIP, statusToneFor } from '@/lib/ui';

// The look of the Calendar page. Each state has a circle mark and a chip fill.
// The state is told by its words and colour only backs them up.
// Red is never used here. It is for the emergency pill only.

// The circle itself. Every value has rounded-full, so a test can tell a circle from a square.
export const MARK_CLASS = {
  accepted: 'rounded-full border-2 border-primary bg-primary',
  requested: 'rounded-full border-2 border-dashed border-primary-text bg-transparent',
  late: 'rounded-full border-2 border-inverse bg-inverse',
  soon: 'rounded-full border-2 border-primary-text bg-transparent',
  later: 'rounded-full border-2 border-muted-foreground bg-transparent',
  past: 'rounded-full border-2 border-calm bg-calm',
  unknown: 'rounded-full border-2 border-calm bg-transparent',
};

// The circle inside a solid chip. Its fill is the words colour of that chip, so it shows on the chip.
const MARK_ON_SOLID = {
  late: 'rounded-full border-2 border-inverse-foreground bg-inverse-foreground',
};

// The chips filled with the ink colour. Their circle and words are drawn in the inverse colours.
export const SOLID_CHIP = { late: true };
export function isSolidChip(mark) {
  return Object.hasOwn(SOLID_CHIP, mark);
}

// The class string for one circle. 12 px across, the same size in every place it appears. On a solid chip
// the circle takes the inverse colour, so it stays visible. The key and the agenda keep the ink circle.
export function markClass(mark, onSolid = false) {
  const look = onSolid && Object.hasOwn(MARK_ON_SOLID, mark) ? MARK_ON_SOLID[mark] : (MARK_CLASS[mark] ?? MARK_CLASS.unknown);
  return `inline-flex size-3 shrink-0 items-center justify-center box-border ${look}`;
}

// Every chip is one filled block, with its words drawn straight on the fill. Requested is the soft blue
// fill, Accepted is a mid grey fill and Past is a pale grey fill with muted words. The other states take
// the fill of their tone (lib/ui.js).
const SHAPE = {
  requested: 'border border-primary-subtle bg-primary-subtle text-primary-text',
  accepted: 'border border-calm bg-calm text-ink',
  past: 'border border-chrome-raised bg-chrome-raised text-muted-foreground',
};

// The fill of a chip, by its mark. Every chip carries its state in words as well.
export const CHIP_TONE = Object.fromEntries(
  Object.keys(MARK_CLASS).map((mark) => [mark, SHAPE[mark] ?? TONE_CHIP[statusToneFor(mark)]]),
);

// The keyboard focus ring, written once. Every link, button and field uses it.
// The ring has a small gap between it and the control. That gap is white by default. This is
// right inside a white card. The page itself is light grey so a control that sits directly on
// the page needs a gap of the same grey. Otherwise the ring shows a white halo. A control
// inside the red-tinted blocks needs a gap of that tint.
export const RING = 'focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2';
export const RING_ON_CANVAS = `${RING} focus-visible:ring-offset-canvas`;
export const RING_ON_WARNING = `${RING} focus-visible:ring-offset-warning-subtle`;

// A text box, password box or text area inside a white card. It is at least 44 px high so a
// thumb can hit it. The border is the darker field border so the edge of the box can be seen.
export const FIELD = `mt-2 w-full min-h-touch rounded border border-input bg-surface px-3 py-2 ${RING}`;

// A date box. Chrome puts a calendar button inside it. When that button has focus the box
// itself is not "focus-visible", so the ring would vanish. "focus-within" covers that case.
export const DATE_FIELD = `${FIELD} focus-within:ring-2 focus-within:ring-primary-strong`;

// The two buttons. Primary is the one main action on a screen. Outline is for everything else
// so two navy blocks never compete.
const BUTTON_BASE = 'inline-flex min-h-touch items-center rounded px-4 font-head text-sm font-semibold';
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-primary text-primary-foreground ${RING}`;
export const BUTTON_OUTLINE = `${BUTTON_BASE} border border-primary bg-surface text-primary ${RING}`;

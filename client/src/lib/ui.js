// The keyboard focus ring is written once. Every link, button and field uses it.
// The ring has a small gap between it and the control. The gap needs the colour of the surface
// the control sits on. Otherwise the ring shows a halo. A control directly on the page needs
// the page colour. A control inside a red tinted block needs that tint. A control on a navy
// bar needs a white ring because the blue one is too faint there.
export const RING = 'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';
export const RING_ON_CANVAS = `${RING} focus-visible:ring-offset-canvas`;
export const RING_ON_WARNING = `${RING} focus-visible:ring-offset-warning-subtle`;
export const RING_ON_CHROME = 'focus-visible:ring-2 focus-visible:ring-chrome-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-chrome';

// A text box, password box or text area inside a white card. The padding makes it about 48 px
// high and min-h-touch is the floor. The border is the darker field border so the edge shows.
export const FIELD = `mt-2 w-full min-h-touch rounded border border-input bg-surface px-3 py-3 ${RING}`;

// A date box. Chrome puts a calendar button inside it. When that button has focus the box
// itself is not "focus-visible" so the ring would vanish. "focus-within" covers that case.
export const DATE_FIELD = `${FIELD} focus-within:ring-2 focus-within:ring-focus`;

// Buttons are 48 px high with the label in the middle. Primary is the one main action on a
// screen. Outline is for everything else so two solid blocks never compete.
const BUTTON_BASE = 'inline-flex min-h-button items-center justify-center rounded px-5 py-3 font-sans text-sm font-semibold leading-snug';
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-primary text-primary-foreground ${RING}`;
export const BUTTON_OUTLINE = `${BUTTON_BASE} border border-primary bg-surface text-primary ${RING}`;
// A primary button that cannot be pressed yet. The page says why in words beside it.
export const BUTTON_DISABLED = `${BUTTON_BASE} bg-disabled text-primary-foreground ${RING}`;
// A white button for the navy side bar. It is white with navy text in both themes.
export const BUTTON_ON_CHROME = `${BUTTON_BASE} bg-chrome-foreground text-chrome ${RING_ON_CHROME}`;
// A quiet action with no box. It is underlined so it does not rely on colour.
export const BUTTON_TEXT = `inline-flex min-h-touch items-center font-sans text-sm font-semibold text-info underline underline-offset-2 ${RING}`;
// For an action that cannot be undone. The red stays on a plain box and never fills it.
export const BUTTON_DANGER = `${BUTTON_BASE} border border-warning bg-surface text-warning-strong ${RING_ON_WARNING}`;
// The last step of something that cannot be undone, such as a permanent delete. It is filled so it
// reads as the final choice. The text is the page colour on the red, which passes in both themes.
export const BUTTON_DANGER_SOLID = `${BUTTON_BASE} bg-warning-strong text-primary-foreground ${RING}`;

// A white card with a thin border. Most blocks of content on a page use it.
export const PANEL = 'rounded-card border border-border bg-surface p-6';

// The keyboard focus ring is written once. Every link, button and field uses it.
// The ring has a small gap between it and the control. The gap needs the colour of the surface
// the control sits on. Otherwise the ring shows a halo. A control directly on the page needs
// the page colour. A control inside a tinted block needs that tint. A control on the side bar
// uses the side bar's own ring colour.
export const RING = 'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';
export const RING_ON_CANVAS = `${RING} focus-visible:ring-offset-canvas`;
export const RING_ON_WARNING = `${RING} focus-visible:ring-offset-warning-subtle`;
export const RING_ON_CHROME = 'focus-visible:ring-2 focus-visible:ring-chrome-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-chrome';

// THE field: a text box, password box, text area and (through SELECT) a dropdown. One fill (the raised
// grey), one edge (--border-control, 3 to 1 against the page, a card and the grey itself), one height
// (48 px) and one corner. Focus turns the edge blue as well as drawing the ring. The ring gap takes the
// card colour because fields sit inside cards.
export const FIELD = `mt-2 w-full min-h-12 rounded-control border border-control bg-chrome-raised px-4 py-2.5 text-base text-ink focus:border-focus ${RING} focus-visible:ring-offset-surface`;
// The dropdown: the same box. Select.jsx draws the chevron. The caller sets the width.
export const SELECT = FIELD;
// The tick box. The browser's own box has an edge that follows its own rules, so it is redrawn:
// an edge in the control colour, a blue fill and a white tick when checked (the .check rule in index.css).
// The caller adds a ring (RING, or the one for the surface it sits on).
export const CHECKBOX = `check h-6 w-6 shrink-0 cursor-pointer appearance-none rounded-bar border border-control bg-chrome-raised`;

// A date box. Chrome puts a calendar button inside it. When that button has focus the box
// itself is not "focus-visible" so the ring would vanish. "focus-within" covers that case.
export const DATE_FIELD = `${FIELD} focus-within:ring-2 focus-within:ring-focus`;

// THE buttons. One set for every page, students and staff alike. 44 px high with a small corner.
//   BUTTON_PRIMARY      the one main action on a screen (blue, filled)
//   BUTTON_OUTLINE      every other action (blue edge, no fill), so two solid blocks never compete
//   BUTTON_TEXT         a quiet action with no box (ghost)
//   BUTTON_DESTRUCTIVE  the first click toward deleting or switching off: an outline in ink, never red
//                       (red is for emergency only). The confirm step uses BUTTON_DANGER_SOLID.
//   BUTTON_LG_*         the 52 px sizes for sign-in and account forms
const BUTTON_BASE = 'inline-flex min-h-touch items-center justify-center gap-2 rounded-control px-5 py-2.5 font-sans text-sm font-semibold leading-snug';
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-primary text-primary-foreground ${RING}`;
export const BUTTON_OUTLINE = `${BUTTON_BASE} border border-primary bg-surface text-primary-text hover:bg-primary-subtle ${RING}`;
export const BUTTON_DESTRUCTIVE = `${BUTTON_BASE} border border-control bg-surface text-ink hover:bg-chrome-raised ${RING}`;
// A primary button that cannot be pressed yet. The page says why in words beside it.
export const BUTTON_DISABLED = `${BUTTON_BASE} bg-disabled text-primary-foreground ${RING}`;
// A button for the side bar. It is the opposite of the bar in both themes.
export const BUTTON_ON_CHROME = `${BUTTON_BASE} bg-chrome-foreground text-chrome ${RING_ON_CHROME}`;
// A quiet action with no box. It is a button, so it has no resting underline; it takes a tint on hover.
export const BUTTON_TEXT = `inline-flex min-h-touch items-center font-sans text-sm font-semibold text-info hover:bg-chrome-raised ${RING}`;
// The last step of something that cannot be undone, such as a permanent delete. It is filled so it
// reads as the final choice. The fill is the strong ink colour, which is black in light mode and
// white in dark mode, so the text uses the inverse colour: black on white in dark mode, and white
// on black in light mode.
export const BUTTON_DANGER_SOLID = `${BUTTON_BASE} bg-warning-strong text-inverse-foreground ${RING}`;

// THE card: a white block with a thin border, a 6 px corner and 22 px of padding. Every block of content
// uses it. The edge is the decorative hairline (--border), not a control edge.
export const CARD = 'rounded-card border border-border bg-surface p-[22px]';

// ---- Sign-in, account and check pages ----

// The page title: plain ink, 24 px on a phone growing to 30 px on a desktop, light tracking.
export const PAGE_TITLE = 'font-head text-[length:clamp(24px,2.7vw,30px)] leading-[1.15] tracking-[-0.01em] text-ink';

// FORM_FIELD and FORM_TEXTAREA are the same field. Both names are kept.
export const FORM_FIELD = FIELD;
export const FORM_TEXTAREA = FIELD;

// The large primary and outline buttons for sign-in and account forms: 52 px high, small corner.
const BUTTON_LG_BASE = 'inline-flex min-h-[52px] items-center justify-center rounded-control px-7 font-sans text-[15px] font-semibold leading-snug';
export const BUTTON_LG_PRIMARY = `${BUTTON_LG_BASE} bg-primary text-primary-foreground ${RING}`;

// Tabs for "Sign in", "Create account" and the other switches. The chosen tab is a soft blue tint with
// bold blue words, not a bar, so the choice shows by colour and weight. The others are plain grey words.
export const TAB = `inline-flex min-h-touch items-center rounded-control px-3 text-sm font-medium text-muted-foreground ${RING}`;
export const TAB_CURRENT = 'bg-primary-subtle font-semibold text-primary-text';
export const TAB_IDLE = 'hover:text-ink';

// ---- Public pages ----

// A topic or category chip: a 44 px pill with a thin border. The chosen one has a soft blue tint, a blue
// border and bold blue words, so the choice does not rely on colour alone.
export const CHIP = 'inline-flex min-h-touch items-center gap-2 rounded-control border border-control px-4 text-sm font-medium text-ink hover:bg-chrome-raised';
export const CHIP_ON = 'inline-flex min-h-touch items-center gap-2 rounded-control border border-primary bg-primary-subtle px-4 text-sm font-semibold text-primary-text';

// ---- THE status pill ----
// A status is a word in a pill and the word carries the meaning, so the pill reads in greyscale. Three
// tones. urgent is solid ink (black in the light theme, white in the dark). current is the soft blue
// tint, for a state that is under way, accepted, published or selected. neutral is a grey pill with a
// control edge, for everything else. No red: red is for the emergency pill only.
export const TONE_COLOURS = {
  urgent: 'border-inverse bg-inverse text-inverse-foreground',
  current: 'border-primary-subtle bg-primary-subtle text-primary-text',
  neutral: 'border-control bg-chrome-raised text-ink',
};
// The chip that stands for the same tone on the Calendar. Every chip is one filled block with its words
// drawn straight on the fill. Urgent is the ink fill with inverse-foreground words, so it flips with the theme.
export const TONE_CHIP = {
  urgent: 'border border-inverse bg-inverse text-inverse-foreground',
  current: 'border border-primary-subtle bg-primary-subtle text-primary-text',
  neutral: 'border border-chrome-raised bg-chrome-raised text-ink',
};
// Which tone each state wears. A state that is not listed is neutral, so a new one is never louder
// than it should be. The pill and the Calendar both read this one list.
const TONE_OF = {
  urgent: 'urgent', late: 'urgent', overdue: 'urgent',
  current: 'current', progress: 'current', checked: 'current',
  published: 'current', complete: 'current', open: 'current',
  in_progress: 'current', resolved: 'current', soon: 'current', requested: 'current',
  // Accepted is grey and Requested is soft blue, so a list tells the two apart.
  neutral: 'neutral', waiting: 'neutral', accepted: 'neutral',
};
export function statusToneFor(state) {
  const key = String(state ?? '').toLowerCase();
  return Object.hasOwn(TONE_OF, key) ? TONE_OF[key] : 'neutral';
}
const PILL_BASE = 'inline-flex items-center whitespace-nowrap rounded-control border px-3 py-0.5 text-xs font-semibold leading-5';
// The class string of a pill for a tone name (urgent, current, neutral) or for a state name.
export function pillClass(toneOrState) {
  return `${PILL_BASE} ${Object.hasOwn(TONE_COLOURS, toneOrState) ? TONE_COLOURS[toneOrState] : TONE_COLOURS[statusToneFor(toneOrState)]}`;
}

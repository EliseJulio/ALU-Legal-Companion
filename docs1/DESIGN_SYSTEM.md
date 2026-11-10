# Design system

The look of the client, decided in the November 2026 redesign. Black, white and blue only, with red kept for emergencies. Source Sans 3 for all type, at a small scale. Every colour is a token in `client/src/index.css`, and `client/tests/lib/tokens.test.js` measures the contrast. This file records the decisions. The code is the source of truth for the values once the build is done.

**Status (9 Nov 2026): built.** The client was reset to the last commit and rebuilt in slices: tokens and Source Sans 3, lucide icons and the two-theme logo, the shell (one sidebar, top bar, bell, avatar menu, phone bars), the overviews for student, lawyer and admin, then every page by group, the Calendar page for each role, the admin bookings list (`GET /admin/bookings`, shown in the admin Calendar) and Reports ("Report a problem" for anyone, `/admin/reports` for the admin). The landing page is shipped.

## Colour

Blue is for progress and "good". White (black in the light theme) is for urgent. Red is for emergency only. No other hue is used.

| Token (existing name) | Dark | Light | Used for |
|---|---|---|---|
| `canvas` | `#000000` | `#FFFFFF` | the page |
| `surface` | `#0B0B0C` | `#FFFFFF` | cards |
| `chrome-raised` | `#131315` | `#F4F4F5` | fields, raised blocks, the open menu item |
| `border` | `#242426` | `#E1E1E5` | card edges and dividers (decoration only, 1.3 to 1) |
| `border-control` | `#8B8B91` | `#6B6B72` | the edge of every control: field, select, chip, tick box, destructive outline button (3 to 1 or more) |
| `border-soft` | `#18181A` | `#EBEBEE` | lines between rows |
| `calm` | `#3A3A3F` | `#D4D4D8` | time already passed, quiet bars |
| `ink` | `#FFFFFF` | `#0A0A0A` | body text |
| `muted-foreground` | `#A3A3A8` | `#55555C` | quiet text |
| `faint` | `#8B8B91` | `#6B6B72` | small notes |
| `primary` | `#1D6AF0` | `#0B57D0` | buttons and filled blue |
| `primary-text` | `#5C9BFF` | `#0B57D0` | blue text, links, progress |
| `primary-subtle` | `#0C1B3A` | `#E6EEFC` | the "Checked" pill ground |
| `primary-foreground` | `#FFFFFF` | `#FFFFFF` | text on blue |
| `inverse` / `inverse-foreground` | `#FFFFFF` / `#000000` | `#0A0A0A` / `#FFFFFF` | urgent pills, the open rail icon |
| `alert` / `alert-foreground` | `#D3122E` / `#FFFFFF` | `#D3122E` / `#FFFFFF` | the Emergency numbers pill |
| `alert-text` | `#FF7A8A` | `#B00A28` | the numbers on the Emergency page |

Contrast measured with the WCAG formula (AA needs 4.5 for text):

- Dark: text 19.7, muted 7.8, faint 5.8, blue text 7.1, white on blue 4.8, Checked pill 6.2, urgent pill 21.
- Light: text 19.8, muted 7.4, faint 5.3, blue 6.4, white on blue 6.4, Checked pill 5.5, urgent pill 19.8.
- Control edge (`border-control`): on the page 5.3 light / 6.2 dark, on a card 5.3 / 5.8, on the raised grey of a field 4.8 / 5.5, on the selected tint 4.5 / 5.0. The blue outline-button edge is 6.4 light / 4.1 dark on a card. The floor is 3 (WCAG 1.4.11). `tests/lib/tokens.test.js` measures each pair.
- Emergency: white on red 5.4, red numbers on dark 7.9, on light 7.2.

## Type

- **Source Sans 3** (400 to 700, one variable file) for everything. Headings 600 with tracking of -0.01em. Large figures 500.
- **IBM Plex Mono** (400, 500) for counts, percentages and law citations.
- Why Source Sans 3: Geist is what many shadcn and AI-made sites use, and the product should not look like them. Source Sans 3 is neutral and book-like, clear for long legal reading, and has a wide range of weights. It has a smaller x-height than Geist, so long titles were checked at 320 and 390 px.
- Self-hosted. The files are `client/public/fonts/source-sans-3-latin-var.woff2`, `ibm-plex-mono-400-latin.woff2` and `ibm-plex-mono-500-latin.woff2`. The app makes no request to another site; a test reads the stylesheet for it.
- Scale: page title `clamp(24px, 2.7vw, 30px)` with line height 1.15; panel and card titles 15px at 600; section titles in a guide 22px; figure strip values 20px with labels 12px; the big deadline number 40px; the gauge number 24px; brand name 16px; sidebar links 13.5px. The emergency number on `/emergency` stays at 44px.
- **Body text never goes below 14px** and small labels never below 12px (the figure labels, the phone bar labels and the small tags are 12px). The one exception is the number badge on the bell, 11px. The long-form guide text stays at 15px with line height 1.7.
- Inter, Lora, Newsreader and Geist are removed from the code and from `client/public/fonts/`.

## Rules that must survive

- A status uses a word and a shape, never colour alone. There is one pill with three tones (`pillClass` in `client/src/lib/ui.js`): urgent is a solid inverted pill, current (under way, accepted, published, selected) is a soft blue pill, neutral is a grey pill with a control edge. `statusToneFor` is the one list of which state wears which tone, read by `StatusPill` and by the Calendar chips (`lib/scheduleStyle.js`). No red.
- The Emergency numbers link is on every page, red, with the warning triangle. It is the `warning` glyph the app already uses. Rule 5 stays.
- "Legal information, not legal advice" stays on every guide page, every route page and in the footer.
- A guide card has no "verified by" line.
- **No legal-expert review wording anywhere.** In this product the admin writes and publishes guides, checklists, routes and directory entries. There is no "needs a legal expert", "waiting for a legal expert", "awaiting review", "only a legal expert can publish" or "checked by a legal expert". Statuses are Draft and Published. A legal expert answers questions, takes appointments and checks files in shared matters, nothing else.
- Ready means a lawyer checked the files. It is never a promise an office will accept them.
- Every control is at least 44 by 44 px. Every page has no sideways scroll at 320 and 390 px.

## The shared component set

One set, in `client/src/lib/ui.js`. A page imports it and never writes its own copy.

- **Buttons** (44 px high, 4 px corner): `BUTTON_PRIMARY` (blue, filled, the one main action), `BUTTON_OUTLINE` (blue edge, every other action), `BUTTON_TEXT` (ghost), `BUTTON_DESTRUCTIVE` (outline in ink with a control edge, the first click toward deleting; not red), `BUTTON_DANGER_SOLID` (the filled confirm step), `BUTTON_DISABLED`, `BUTTON_ON_CHROME`, and the 52 px `BUTTON_LG_PRIMARY`. `ADMIN_BUTTON_*` in `AdminRecords.jsx` are aliases of these.
- **Card**: `CARD`, a white block with a 1 px `border`, 6 px corner and 22 px padding. `PANEL` is gone.
- **Field**: `FIELD` (also `FORM_FIELD`, `FORM_TEXTAREA`, `SELECT`): raised grey fill, `border-control` edge, 48 px high, 4 px corner, blue edge on focus. The dropdown is `Select.jsx` with the chevron drawn as an icon. `CHECKBOX` is a 24 px box with a control edge that turns solid blue with a white tick. `CHIP` and `CHIP_ON` use the same edge.
- **Pill**: `pillClass(tone)`, see Rules that must survive.
- **Control edge**: every control with no fill of its own uses `border-control`; `border` stays for cards and dividers.

## Shell

- Signed-in roles: ONE sidebar (264 px) and a top bar (search, theme, Emergency numbers, bell, avatar menu). Each row is an icon and its label. The sidebar header shows the logo beside "Legal" over "Companion" on two lines and, under a divider, only the person's name: no role line and no "Students & staff" subtitle. The sidebar can be narrowed to 76 px with icons only (the open page becomes an inverted square). The choice is kept on the device and announced to a screen reader. Sign out is at the foot of the sidebar, in the avatar menu (Account and Sign out) and in the More sheet on a phone.
- The open page in the sidebar is a soft grey row (the raised surface) with a bold label and the icon in the normal ink colour, with `aria-current="page"`. There is no blue bar and no blue icon (they looked generic). Narrowed, the open page is the inverted square. The More sheet and the phone bar mark the open page the same way, with grey and bold.
- A visitor gets a top bar and no menu.
- Every role has its own overview: student Home, lawyer Overview, admin Overview. Each greets the person by name.
- Icons are **`lucide-react`**, a standard, documented package, so every icon can be explained and swapped by changing one name. Thin line (stroke 1.5), small and responsive: about 15 px on phones, up to 17 px on desktop, set once in one icon component. Only the icons used are imported. Not the icon font and not hand-drawn paths.
- The ALU logo (`client/src/assets/brand/alu-logo.png`) is the first thing in the rail, the menu, the visitor top bar and the phone top bar. It is shown plain, with no tile. On the dark theme it is the original, bright. On the light theme the pale grey half is recoloured to a mid grey (`#6C6966`) so it reads on white, and the red stays as it is.
- Phone and tablet (below 1180 px): a slim top bar (logo, search, Emergency, bell), a bottom bar with four quick links and More, and a More sheet with every page and the theme. The theme toggle is in the top bar, at the foot of the menu and in the More sheet: Light, Dark, System.
- **Calendars.** Each role has one page called Calendar (`/calendar`, `/expert/calendar`, `/admin/calendar`) and the old Appointments addresses redirect to it. Matter deadlines use a solid colour per state: Late (white, black in light), Due within 7 days (blue), Later (grey). A student sees their own deadlines and bookings, a lawyer sees the consultations booked with them (this week and the month) and can accept or decline a request, an admin sees every scheduled consultation, view only, with no requester shown and no actions. A consultation request is a booking.

## The bell

It lists what the app already emails about, plus the reminder schedule: a reminder sent, the next reminder, an appointment accepted, a question answered, a lawyer checking a document. Opening an item marks it read. The read state is kept on the device.

- `GET /api/matters/reminders` returns the reminders of open matters, pending or sent.
- `GET /api/matters/progress` returns the document counts of each open matter. Home uses it for Documents ready and Progress by matter.

## Home (student)

Ticker figures, Documents ready with a matter picker fed by Progress by matter, Next deadline with the 30-day bar, and What needs you.

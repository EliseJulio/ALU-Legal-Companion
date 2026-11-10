# ALU Legal Companion: client

The website of the platform. A student or staff member uses it to find a lawyer, consultant or organisation, to see where a legal matter must go first, to track a matter with reminders and to read guides an administrator has published. Administrators write and publish all of the content (guides, checklists, routes and directory entries; the statuses are Draft and Published). Legal experts answer questions, take appointments and read the matters shared with them.

- **Built with:** React 19, Vite, Tailwind CSS, React Router
- **Tests:** Vitest with Testing Library for the components, Playwright for the browser
- **Talks to:** the API in [`../server`](../server/README.md)
- **Live:** https://alu-legal-companion-qu8w.onrender.com. It talks to the live API at https://alu-legal-companion.onrender.com

## Set up

You need a recent Node.js. Node.js 24 is what the tests and CI use. The server should be running for real data. See the [server README](../server/README.md).

```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

The site finds the API at `http://localhost:4000/api`. To use another address copy `.env.example` to `.env` and set `VITE_API_URL`. That address is public so it must never hold a secret.

The live website is built with `VITE_API_URL=https://alu-legal-companion.onrender.com/api`. Vite puts that address into the files when it builds, so changing it on the host does nothing until the site is built again.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the site and reloads it when a file changes |
| `npm run build` | Makes the files to publish in `dist/` |
| `npm run preview` | Serves the built files to check them |
| `npm test` | Runs the component and unit tests |
| `npm run e2e` | Runs the browser tests at the width of a phone |
| `npm run screenshots` | Takes new screenshots of the pages into `docs1/screenshots`. The folder is not kept in the repository |
| `npm run lint` | Checks the code with oxlint |

## The pages

The routes are in `src/App.jsx` and the menu links are in `src/lib/nav.js`.

| Who | Pages |
|---|---|
| Anyone | `/` front door, `/directory` (with the guided questions that say where a matter goes first), `/directory/:id`, `/directory/book/:id`, `/directory/booking-check`, `/guides` and `/guides/:id`, `/search`, `/ask`, `/ask-ai`, `/ask/check`, `/check-request`, `/report`, `/report/sent`, `/report/check`, `/emergency` |
| Accounts | `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/confirm-email-change`, `/redeem-invite` |
| Student or staff | `/home`, `/matters`, `/matters/new`, `/matters/:id`, `/calendar`, `/saved`, `/my-activity`, `/settings` |
| Legal expert | `/expert` overview, `/expert/questions`, `/expert/calendar`, `/expert/matters` |
| Admin | `/admin` overview, `/admin/calendar`, `/admin/guides`, `/admin/checklists`, `/admin/providers`, `/admin/routes`, `/admin/ladder/new` and `/admin/ladder/:id`, `/admin/reports`, `/admin/users`, `/admin/invites`, `/admin/contacts` (each list has its own `new` and `:id` editor page) |

Old addresses still work and redirect: `/where-to-go` and `/where-to-go/:id` go to the Directory, `/appointments`, `/expert/appointments`, `/expert/bookings` and `/admin/appointments` go to the Calendar of that role.

A page that a person's role cannot use explains why. It does not redirect and it never signs anyone out. The server is the real gate. The pages only avoid sending a request that the server would refuse.

## How the code is organised

```text
src/
  main.jsx, App.jsx    start up and the list of routes
  index.css            the colours and fonts as variables (two themes, dark and light)
  lib/                 api.js (calls to the server), auth.js, AuthContext.jsx, useApi.js,
                       nav.js (the menu links), icons.js (icon names), ui.js (shared styles),
                       dates.js, directory.js, bookings.js, email.js, url.js
  components/          the parts that pages share: Layout, TopBar, MenuPanel, BottomBar, Footer,
                       ProviderCard, TokenDisplay, MeetLink, StatusPill, Field, RequireRole, OwnerOnly
                       and more. wizard/ holds the step-by-step editors and overview/ the home panels
  pages/               one file for each page
tests/                 the component tests, laid out like src/
  e2e/                 the browser tests and the screenshot script
```

## Design rules

These come from the research brief and are checked by tests.

The Figma designs the pages follow: https://www.figma.com/design/qQwmLeedehTnVPjx0cDJyu

- **Colours.** Black, white and blue, in a dark and a light theme. Red is kept for the Emergency numbers link and the Emergency page. A colour is never the only thing that carries a meaning. A word or an icon always goes with it. The values are tokens in `src/index.css` and are written up in [`../docs1/DESIGN_SYSTEM.md`](../docs1/DESIGN_SYSTEM.md). `tests/lib/tokens.test.js` checks the contrast and that no colour is used with an opacity suffix, which Tailwind would silently drop.
- **Type.** Source Sans 3 for all text and IBM Plex Mono for counts and law citations, both served from `public/fonts/`. The app makes no request to another site on its own.
- **Touch targets.** Every link and button is at least 44 by 44 pixels. The browser tests measure the menus and bars.
- **Focus.** Every control shows a ring when it has keyboard focus. The ring styles live in one file, `src/lib/ui.js`, so they cannot drift apart.
- **Urgent help.** The emergency numbers link is in the header on every page and comes before the menu in the keyboard order. The urgent numbers are written into the page. They show even when the server is down.
- **Disclaimer.** "Legal information not legal advice." is in the footer of every page.
- **Anonymous flows.** A one-time code is shown once and the reader must say they saved it. The code is kept in the page and sent in one request. It is never put in the address bar. The page sends an anonymous request without the login, even for a signed-in person.
- **No AI.** The site has no assistant and no chatbot. A real legal expert answers every question.
- **One publisher.** An administrator publishes alone. A guide, checklist, route or directory entry is Draft or Published, and editing a published one takes it back to Draft until it is published again. The site shows no "awaiting review" step.

## How the site talks to the server

`src/lib/api.js` is the only place that makes requests.

- It sends the login as a bearer token and reads the server's `{ "error": "..." }` message.
- A **401** means the session has ended. The site clears the saved login. A **403** means the login is fine and the role is wrong, so the login is kept. For this reason the server answers a wrong current password with 400 and not 401. Otherwise a typo would sign the person out.
- A link is made from stored text only when it is a full `https` address (`secureAddress` in `src/lib/url.js`).
- A page that needs a login asks the server only when the person is signed in as a role the server accepts.

## Tests

```bash
npm test        # the component and unit tests: 138 test files in tests/
npm run e2e     # the browser tests: 25 spec files in tests/e2e/
```

The component tests live in `tests/`. The browser tests live in `tests/e2e/`. They run the real pages in Chromium at 390 pixels wide. The API is replaced in each test by fixed replies from `tests/e2e/support.js`, so no server or database is needed and no test can change real data. The first run starts the dev server by itself.

The browser tests need the browser once: `npx playwright install chromium`.

## Notes

- `dist/` is made by the build. It is not kept in git.
- A static host must send every address to `index.html` so a reload on `/matters/7` works. On Render this is one rewrite rule from `/*` to `/index.html`. Without it a reload or a link from an email, shows "Not Found"..

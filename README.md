# ALU Legal Companion

A web platform that helps ALU students and staff find the right legal help in Rwanda.

It brings together five things:

- **Lawyers** who can take a matter.
- **Consultants** who give advice.
- **Organisations** that solve legal problems such as Abunzi committees, labour inspectors and legal aid offices.
- **Recommendations** that tell a person which body a matter must go to first with the steps and the deadline.
- **Tracking and follow-ups** for a person's own matters with reminders before a deadline.
- **Ask AI**, a small feature that answers a question in a few sentences using only the published guides. It stores nothing, names its source guides and refuses when no guide matches. It needs a Gemini API key (see Deployment).

Capstone project by Elise Julio HAKIZIMANA, BSc Software Engineering, African Leadership University, Rwanda.

GitHub: https://github.com/EliseJulio/ALU-Legal-Companion

Live website: https://alu-legal-companion-qu8w.onrender.com

Live API and its documentation: https://alu-legal-companion.onrender.com/api/docs

Figma designs: https://www.figma.com/design/qQwmLeedehTnVPjx0cDJyu

Demo video: https://docs.google.com/document/d/1uJ3P1m0gzIfPTzAp2jOerD2FcY8s8pMm5xwarBX27TU/edit?usp=sharing

Technical report (PDF, 4 pages): [docs1/ALU_Legal_Companion_Technical_Report.pdf](docs1/ALU_Legal_Companion_Technical_Report.pdf)

## Why it exists

Rwanda publishes its laws but ordinary people find them hard to use. A student with a legal problem often does not know which office must hear it first. Going to the wrong one can mean being turned away or missing a deadline. This platform shows where each kind of matter goes first, with the law behind it, the steps and the deadline. It also lets a person ask a legal expert a question without giving their name.

## The rule that matters most

**Nothing is shown to the public until an authorized administrator has checked and published it.** That covers every guide, directory entry and route. Administrators create, edit, publish and withdraw legal-information content; legal experts provide consultations, appointments and matter support. If a published guide is edited it leaves the site at once and comes back only when an administrator publishes it again. The database refuses a published row that has no publisher. A real person answers every question sent to a legal expert. Ask AI is a small helper, it answers only from published guides, shows the guide it used and says it may be wrong.

## Stack

- **Backend:** Node.js 20 or newer, Express 4 (ES modules), REST under `/api`
- **Database:** PostgreSQL 16, plain SQL through `pg`
- **Frontend:** React, Vite and Tailwind CSS
- **Calls:** a one-to-one WebRTC call between the two browsers. A small Cloudflare Worker (`signaling/`) passes the set-up messages and Cloudflare Realtime supplies a relay when a direct connection is blocked. Nothing is recorded
- **Tests:** Jest and Supertest for the API, Vitest and Testing Library for the pages, Playwright for the browser, Vitest for the Worker

## Technical requirements

| Part | Version used | Notes |
|---|---|---|
| Node.js | 24 (used for every test run and for CI) | The server runs on 20 or newer. The client tests need a recent Node. They failed on an older Node 20 build |
| PostgreSQL | 16 | Any 14 or newer should work. Tested on 16 |
| Express | 4.19 | With `helmet`, `cors`, `express-rate-limit`, `jsonwebtoken`, `bcryptjs`, `nodemailer`, `swagger-ui-express` |
| React | 19.2 | With React Router 7, Vite 8 and Tailwind CSS 3.4 |
| Test tools | Jest 29, Vitest 4, Playwright 1.64 | Playwright needs its browser: `npx playwright install chromium` |
| Hardware | Any computer that runs Node 20 | 4 GB of memory is enough. No GPU needed |
| Browsers | Chromium | The browser tests run in Chromium only (`client/playwright.config.js`) |

## Repository layout

```
server/
  src/
    routes/       one file for each part of the API (auth, directory, guides, matters, documents, ...)
    services/     the rules: routing, reminders, anonymous code, document encryption, email, search
    middleware/   login and roles, rate limits, input checks
    migrations/   42 numbered SQL files (001 to 042) that build the database tables
    openapi.js    the Swagger description of every route
  tests/          integration and unit tests against a real database
client/
  src/
    pages/        one file for each screen (57)
    components/   parts used by many screens (over 80)
    lib/          the API caller, login state, dates and small helpers
  tests/          component tests and browser tests
signaling/        the Cloudflare Worker that passes the set-up messages of a call, its tests and its README
docs1/            API specification, database design, test plan and the technical report
.github/          the CI workflow that runs the tests on every push and the scheduled job that runs the reminders
render.yaml       how the live version is deployed
```

## Run it

You need Node.js 24 (20 or newer is enough to run the server) and PostgreSQL 16.

```bash
# 1. the database (once)
psql -U postgres -c "CREATE USER alu WITH PASSWORD 'alu_dev' CREATEDB;"
psql -U postgres -c "CREATE DATABASE alu_legal OWNER alu;"
psql -U postgres -c "CREATE DATABASE alu_legal_test OWNER alu;"

# 2. the server  ->  http://localhost:4000
cd server
npm install
cp .env.example .env        # then set JWT_SECRET, see server/README.md
npm run migrate
NODE_ENV=development npm run seed   # demo passwords are allowed only in development
npm run dev

# 3. the website, in a second terminal  ->  http://localhost:5173
cd client
npm install
npm run dev
```

In PowerShell, set the variable first: `$env:NODE_ENV='development'; npm run seed`.

Check the server with `curl http://localhost:4000/api/health`. The full settings, with their defaults, are in [`server/README.md`](server/README.md) and [`client/README.md`](client/README.md).

**The demo data starts hidden.** The seed adds directory entries, routes, dispute ladder steps, guides and checklists as drafts. Sign in as an administrator and publish the records you want to appear publicly.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Administrator | admin@example.org | dev_admin_password |
| Legal expert | expert@example.org | dev_expert_password |
| Student | test.student@alustudent.com | dev_student_password |

These are for local use only. Never use them anywhere real. With no mail settings the server prints each email link in its terminal, so every flow can be tried without a mail account.

## Tests

| Layer | Tool | Count |
|---|---|---|
| API and database | Jest and Supertest against a real database | 113 tests in 9 files |
| Pages and components | Vitest and Testing Library | 76 tests in 14 files |
| Browser at phone width | Playwright with the API replaced by fixed replies | 13 tests in 5 files, run in Chromium (the default) |
| Call signaling Worker | Vitest | 97 tests in 3 files |

These are the key tests. The repository holds this set and further tests are kept outside it. CI runs four jobs on every push: the server, the client (tests, build and lint), the browser tests and the Worker. Measured on 19 November 2026. The booking features were also walked through once against a real server, a real database and a real browser, with no stubs. [`docs1/TEST_PLAN.md`](docs1/TEST_PLAN.md) lists every test in this set.

```bash
cd server && npm test
cd client && npm test && npm run e2e
cd signaling && npm test
```

On Windows, run the server tests in batches of five files, as described in [`server/README.md`](server/README.md).

## Designs

The design is easy to read, usable on a phone and accessible by default. The built screens are the design record.

- Black, white and blue in a dark and a light theme, with red only for emergencies. A colour never carries a meaning alone.
- Every link and button is at least 44 by 44 pixels. Every control shows a focus ring.
- The emergency numbers link is on every page and the urgent numbers show even when the server is down.
- The disclaimer "Legal information not legal advice." is in every footer.

Figma mockups: https://www.figma.com/design/qQwmLeedehTnVPjx0cDJyu

## The live version

The platform is deployed on Render. Anyone can open the website and browse with no account.

| Part | Address | What to do there |
|---|---|---|
| Website | https://alu-legal-companion-qu8w.onrender.com | Use the platform. Start at the Directory (its guided questions say where a matter goes first) or the Legal guides. Register with an `@alustudent.com` or `@alueducation.com` address to track matters, book a consultation or save guides |
| API | https://alu-legal-companion.onrender.com | The server behind the website. `https://alu-legal-companion.onrender.com/api/health` answers `{"status":"ok"}` when it is running |
| API documentation | https://alu-legal-companion.onrender.com/api/docs | Every route, who may call it and what it returns. Each route can be tried from the page. The raw file is at `/api/openapi.json` |
| Database | PostgreSQL on Render | Private. Only the API can reach it |

Things to know when you use the live version:

- **Waking up.** On a free Render plan the server sleeps when nobody has used it for a while. The first request after that can take up to a minute.
- **Its own accounts.** The live site has its own accounts and passwords. The demo passwords in this file work only on a local copy.
- **Real email.** Verification links, password reset links, reminders and the notices about consultations and documents are really sent. The link in each email points to the live website.
- **Real data.** Whatever is entered on the live site is stored in the live database. Do not run the Postman collection against it. It creates records named "Postman" and signs in with the demo passwords.
- **Roles.** Only an administrator can publish. Legal experts join by an emailed invitation from an administrator.

## Privacy

The platform is designed with Rwanda's personal data protection law (Law No. 058/2021) in mind. The website has a Privacy page that says what is kept. In short:

- An anonymous question or booking stores no name, no email and no account. The person gets a one-time code, shown once.
- Anonymous questions answered more than 90 days ago and anonymous bookings whose slot was more than 90 days ago, are deleted.
- The database is in Oregon, United States, outside Rwanda.
- Files a person attaches to a matter are encrypted with AES-256-GCM before they are stored in the database. The key is kept only in the server's settings.
- Ask AI sends a question to Google only after the person ticks the box to agree. The platform keeps no chat log and no identity for it.

## Deployment

How the live version is set up and how to set up another one.

| Part | Where it runs | Notes |
|---|---|---|
| Website | A Render static site | Root folder `client`. Build with `npm ci && npm run build` and publish `dist`. Set `VITE_API_URL` to `https://alu-legal-companion.onrender.com/api` before the build. The address is baked in at build time, so a change needs a new build. Add a rewrite rule from `/*` to `/index.html` so a reload on a deep link works |
| API | A Render web service in Oregon | Root folder `server`. Build with `npm ci`. The start command is `npm run migrate && npm start`, because the free plan has no pre-deploy step. Health check path `/api/health`. `render.yaml` asks for the free plan. The service sleeps when idle |
| Database | PostgreSQL on Render, Oregon | Created by hand in the Render dashboard. The API uses its internal address. A database on the free plan expires about 30 days after it is made. The technical report puts the live database's expiry at around 28 November 2026, so upgrade it or export a backup before then |
| Email | Your mail provider, over SMTP | Verification links, reminders and notices need real email. Set `SMTP_URL` to the provider and `MAIL_FROM` to a verified sender |
| Calls | A Cloudflare Worker in `signaling/` | Deploy with `npm run deploy` in `signaling/`. Set its secret with `npx wrangler secret put CALL_TICKET_SECRET`, the same value as the API's `CALL_TICKET_SECRET` |
| Scheduled jobs | GitHub Actions, `.github/workflows/jobs.yml` | Calls `POST /api/internal/run-jobs` every ten minutes. Needs the repository secrets `JOB_URL` and `JOB_SECRET` |

The file `render.yaml` describes the three Render parts. Most secret values are typed into the Render dashboard and are not stored in the file. The full list of settings, with defaults, is in [`server/README.md`](server/README.md).

Settings for the API on the host:

- `JWT_SECRET`: a random value of at least 32 characters. The server refuses a short value and the example values in the template. Never reuse a development value.
- `DATABASE_URL`: the managed database address.
- `CORS_ORIGINS`: the website address and nothing else.
- `APP_URL`: the website address. Email links are built from it.
- `TRUST_PROXY`: `1` when the host puts one proxy in front of the server. This makes the rate limits see each person's real address.
- `REMINDERS`: leave empty to run the reminder check inside the server, which runs it every ten minutes while the server is awake. Two checks never run at once, so a reminder is not sent twice. Set it to `off` only if you run `npm run reminders` from a scheduled job instead.
- `JOB_SECRET`: at least 32 characters. It switches on `POST /api/internal/run-jobs`, which runs the deadline and consultation reminders and the clean-up of old anonymous records. The GitHub workflow `.github/workflows/jobs.yml` calls it every ten minutes, which also wakes a host that sleeps when idle. Add the same value as the GitHub secret `JOB_SECRET` and the full address of the route as the GitHub secret `JOB_URL`, for example `https://<api host>/api/internal/run-jobs`. The workflow fails with a message if either secret is empty. Shorter than 32 characters, the route answers 404.
- `DAILY_EMAIL_BUDGET`: how many optional emails a day may be sent (default 180, counted per day in Kigali). Sign-in, password, email-change, invitation, report-reply and consultation-accepted mail always goes. Deadline and consultation reminders, document notices and the request, decline, cancel and time-change notices stop at the budget.
- `NODE_ENV`: `production`. The server then refuses to start with no `CORS_ORIGINS` and never prints an email link in its log.
- `DOCUMENT_KEY`: 64 hex characters that encrypt the documents people attach to a matter. The encrypted files are kept in the database, so they survive a restart or a new deploy. With no key, uploads answer 503. Keep a copy somewhere safe. If it is lost, every stored document is lost with it.
- `GEMINI_API_KEY` and `GEMINI_MODEL`: optional. They switch on Ask AI. With either missing, Ask AI answers that it is not available and the rest of the site is unaffected. Copy a current free-tier model id from Google's model list, because Google retires model ids over time. `ASK_AI_DAILY_LIMIT` caps model calls a day (default 200).
- `CALL_TICKET_SECRET` and `CALL_SIGNAL_URL`: optional. Together they switch on calls held inside the platform. The secret must be at least 32 characters and the same value must be set on the Cloudflare Worker with `npx wrangler secret put CALL_TICKET_SECRET` in `signaling/`. The address must start with `wss://`. With either missing, a consultation uses a Daily room (which lasts until four hours after the appointment) if that is set up and otherwise the lawyer's Google Meet link. `CALL_TURN_KEY_ID` and `CALL_TURN_API_TOKEN` are optional and add a Cloudflare relay for networks that block a direct connection.
- `SEED_ADMIN_PASSWORD`, `SEED_EXPERT_PASSWORD` and `SEED_STUDENT_PASSWORD`: the passwords the seed gives the three demo accounts. Set your own before the first seed so the demo passwords never exist on a live database.

First release checklist:

1. Create the database and run `npm run migrate`.
2. Create the accounts by running `npm run seed` once with your own `SEED_*_PASSWORD` values set, so the demo passwords never exist in production. The seed adds the records as drafts and publishes nothing.
3. Invite the real legal experts from the admin pages and link each to their directory entry where appropriate.
4. Have an authorized administrator check and publish the guides, entries and routes. The public pages stay empty until they do.
5. Send a test verification email and a test reminder.
6. Check the urgent help page shows the right numbers.

## Documentation

- [`docs1/ALU_Legal_Companion_Technical_Report.pdf`](docs1/ALU_Legal_Companion_Technical_Report.pdf): scope against the proposal, how it works, testing and code quality
- [`docs1/API_SPEC.md`](docs1/API_SPEC.md): who may call each route and what it returns
- [`docs1/ERD.md`](docs1/ERD.md): the database tables and the rules the database enforces itself
- [`docs1/TEST_PLAN.md`](docs1/TEST_PLAN.md): what is tested, what the tests found and what is not tested
- [`server/README.md`](server/README.md): the API, its settings and the eight rules it enforces
- [`client/README.md`](client/README.md): the website, its pages and its design rules
- [`signaling/README.md`](signaling/README.md): the call Worker, its endpoints, its tickets and its settings
- [Live API documentation](https://alu-legal-companion.onrender.com/api/docs): every route in Swagger. The same description is in `server/src/openapi.js`
- [`server/ALU_Legal_Companion.postman_collection.json`](server/ALU_Legal_Companion.postman_collection.json): every route as a Postman collection with its checks. Use it on a development database only

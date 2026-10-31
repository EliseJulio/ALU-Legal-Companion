# ALU Legal Companion

A web platform that helps ALU students and staff find the right legal help in Rwanda.

It brings together five things:

- **Lawyers** who can take a matter.
- **Consultants** who give advice.
- **Organisations** that solve legal problems such as Abunzi committees, labour inspectors and legal aid offices.
- **Recommendations** that tell a person which body a matter must go to first with the steps and the deadline.
- **Tracking and follow-ups** for a person's own matters with reminders before a deadline.

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

**Nothing is shown to the public until an authorized administrator has checked and published it.** That covers every guide, directory entry and route. Administrators create, edit, publish and withdraw legal-information content; legal experts provide consultations, appointments and matter support. If a published guide is edited it leaves the site at once and comes back only when an administrator publishes it again. The database refuses a published row that has no publisher. The platform has no AI. A real person answers every question.

## Stack

- **Backend:** Node.js 20 or newer, Express 4 (ES modules), REST under `/api`
- **Database:** PostgreSQL 16, plain SQL through `pg`
- **Frontend:** React, Vite and Tailwind CSS
- **Tests:** Jest and Supertest for the API, Vitest and Testing Library for the pages, Playwright for the browser

## Technical requirements

| Part | Version used | Notes |
|---|---|---|
| Node.js | 24 (used for every test run and for CI) | The server runs on 20 or newer. The client tests need a recent Node. They failed on an older Node 20 build |
| PostgreSQL | 16 | Any 14 or newer should work. Tested on 16 |
| Express | 4.19 | With `helmet`, `cors`, `express-rate-limit`, `jsonwebtoken`, `bcryptjs`, `nodemailer`, `swagger-ui-express` |
| React | 19.2 | With React Router 7, Vite 8 and Tailwind CSS 3.4 |
| Test tools | Jest 29, Vitest 4, Playwright 1.64 | Playwright needs its browsers: `npx playwright install` |
| Hardware | Any computer that runs Node 20 | 4 GB of memory is enough. No GPU needed |
| Browsers | Chrome, Firefox and Safari engines | The browser tests run in all three |

## Repository layout

```
server/
  src/
    routes/       one file for each part of the API (auth, directory, guides, matters, documents, ...)
    services/     the rules: routing, reminders, anonymous code, document encryption, email, search
    middleware/   login and roles, rate limits, input checks
    migrations/   26 numbered SQL files that build the 17 tables
    openapi.js    the Swagger description of every route
  tests/          integration and unit tests against a real database
client/
  src/
    pages/        one file for each screen (41)
    components/   parts used by many screens (34)
    lib/          the API caller, login state, dates and small helpers
  tests/          component tests and browser tests
docs1/            API specification, database design, test plan and the technical report
.github/          the CI workflow that runs the tests on every push
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
npm run seed
npm run dev

# 3. the website, in a second terminal  ->  http://localhost:5173
cd client
npm install
npm run dev
```

Check the server with `curl http://localhost:4000/api/health`. The full settings are in [`server/README.md`](server/README.md) and [`client/README.md`](client/README.md).

**The demo data starts hidden.** The seed adds directory entries, routes and guides as drafts. Sign in as an administrator and publish the records you want to appear publicly.

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
| API and database | Jest and Supertest against a real database | 810 tests in 45 suites |
| Pages and components | Vitest and Testing Library | 996 tests in 83 files |
| Browser at phone width | Playwright with the API replaced by fixed replies | 197 tests in 17 files. Run in Chromium (197 pass), Firefox (197 pass) and WebKit (195 pass, 2 known failures) |

```bash
cd server && npm test
cd client && npm test && npm run e2e
```

## Designs

The design is easy to read, usable on a phone and accessible by default. The built screens are the design record.

- ALU navy and red on white. A colour never carries a meaning alone.
- Every link and button is at least 44 by 44 pixels. Every control shows a focus ring.
- The emergency numbers link is on every page and the urgent numbers show even when the server is down.
- The disclaimer "Legal information not legal advice." is in every footer.

Figma mockups: https://www.figma.com/design/qQwmLeedehTnVPjx0cDJyu

## The live version

The platform is deployed on Render. Anyone can open the website and browse with no account.

| Part | Address | What to do there |
|---|---|---|
| Website | https://alu-legal-companion-qu8w.onrender.com | Use the platform. Start at Where to Go, the Directory or the Legal Guides. Register with an `@alustudent.com` or `@alueducation.com` address to track matters, book a consultation or save guides |
| API | https://alu-legal-companion.onrender.com | The server behind the website. `https://alu-legal-companion.onrender.com/api/health` answers `{"status":"ok"}` when it is running |
| API documentation | https://alu-legal-companion.onrender.com/api/docs | Every route, who may call it and what it returns. Each route can be tried from the page. The raw file is at `/api/openapi.json` |
| Database | PostgreSQL on Render | Private. Only the API can reach it |

Things to know when you use the live version:

- **Waking up.** On a free Render plan the server sleeps when nobody has used it for a while. The first request after that can take up to a minute.
- **Its own accounts.** The live site has its own accounts and passwords. The demo passwords in this file work only on a local copy.
- **Real email.** Verification links, password reset links, reminders and the notices about consultations and documents are really sent. The link in each email points to the live website.
- **Real data.** Whatever is entered on the live site is stored in the live database. Do not run the Postman collection against it. It creates records named "Postman" and signs in with the demo passwords.
- **Roles.** Only an administrator can publish. Legal experts join by an emailed invitation from an administrator.

## Deployment

How the live version is set up and how to set up another one.

| Part | Where it runs | Notes |
|---|---|---|
| Website | A Render static site | Root folder `client`. Build with `npm ci && npm run build` and publish `dist`. Set `VITE_API_URL` to `https://alu-legal-companion.onrender.com/api` before the build. The address is baked in at build time, so a change needs a new build. Add a rewrite rule from `/*` to `/index.html` so a reload on a deep link works |
| API | A Render web service | Root folder `server`. Build with `npm ci`. Start with `npm run migrate && npm start`. Health check path `/api/health` |
| Database | PostgreSQL on Render | The API uses its internal address. Free databases expire after about 30 days, so upgrade or back up before then |
| Email | Brevo SMTP relay on port 2525 | Verification links, reminders and notices need real email. Set `SMTP_URL` and a verified `MAIL_FROM` |

Settings for the API on the host:

- `JWT_SECRET`: a new random value of 32 characters or more. Never reuse the development one.
- `DATABASE_URL`: the managed database address.
- `CORS_ORIGINS`: the website address and nothing else.
- `APP_URL`: the website address. Email links are built from it.
- `TRUST_PROXY`: `1` when the host puts one proxy in front of the server. This makes the rate limits see each person's real address.
- `REMINDERS`: leave empty to run the reminder check inside one server. If the host runs more than one copy of the server set it to `off` and run `npm run reminders` from a scheduled job once an hour. Otherwise reminders could be sent twice.
- `NODE_ENV`: `production`. The server then refuses to start with no `CORS_ORIGINS` and never prints an email link in its log.
- `DOCUMENT_KEY`: 64 hex characters that encrypt the documents people attach to a matter. With none, uploads answer 503. Keep a copy somewhere safe. If it is lost, every stored document is lost with it.
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
- [`docs1/ERD.md`](docs1/ERD.md): the 17 tables and the rules the database enforces itself
- [`docs1/TEST_PLAN.md`](docs1/TEST_PLAN.md): what is tested, what the tests found and what is not tested
- [`server/README.md`](server/README.md): the API, its settings and the eight rules it enforces
- [`client/README.md`](client/README.md): the website, its pages and its design rules
- [Live API documentation](https://alu-legal-companion.onrender.com/api/docs): every route in Swagger. The same description is in `server/src/openapi.js`
- [`server/ALU_Legal_Companion.postman_collection.json`](server/ALU_Legal_Companion.postman_collection.json): every route as a Postman collection with its checks. Use it on a development database only

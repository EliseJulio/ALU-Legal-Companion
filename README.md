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

Demo video: 

## Why it exists

Rwanda publishes its laws but ordinary people find them hard to use. A student with a legal problem often does not know which office must hear it first. Going to the wrong one can mean being turned away or missing a deadline. This platform shows where each kind of matter goes first, with the law behind it, the steps and the deadline. It also lets a person ask a legal expert a question without giving their name.

## The rule that matters most

**Nothing is shown to the public until an authorized administrator has checked and published it.** That covers every guide, directory entry and route. Administrators create, edit, publish and withdraw legal-information content; legal experts provide consultations, appointments and matter support. If a published guide is edited it leaves the site at once and comes back only when an administrator publishes it again. The database refuses a published row that has no publisher. The platform has no AI. A real person answers every question.

## What it looks like

| Front door | Where to go | Directory | Track a matter |
|---|---|---|---|
| <img src="docs/screenshots/phone/01-home.png" width="170" alt="The front door with the five things the platform is for"> | <img src="docs/screenshots/phone/03-route.png" width="170" alt="A route with the office, the law, the steps and the deadline"> | <img src="docs/screenshots/phone/04-directory.png" width="170" alt="The directory of lawyers, consultants and organisations"> | <img src="docs/screenshots/phone/12-matter.png" width="170" alt="A tracked matter with its deadline and reminders"> |

## Stack

- **Backend:** Node.js 20 or newer, Express 4 (ES modules), REST under `/api`
- **Database:** PostgreSQL 16, plain SQL through `pg`
- **Frontend:** React, Vite and Tailwind CSS
- **Tests:** Jest and Supertest for the API, Vitest and Testing Library for the pages, Playwright for the browser

## Repository layout

```
server/   Express API and database      (see server/README.md)
client/   React frontend                (see client/README.md)
```

## Run it

You need Node.js 20 or newer and PostgreSQL 16.

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
| API and database | Jest and Supertest against a real database | 778 tests in 43 suites |
| Pages and components | Vitest and Testing Library | 968 tests in 82 files |
| Browser at phone width | Playwright with the API replaced by fixed replies | 197 tests in 17 files |

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

## Deployment plan

This is a plan. Nothing is deployed yet.

| Part | Where it can run | Notes |
|---|---|---|
| Website | Any static host such as Netlify, Vercel or Cloudflare Pages | Build with `npm run build` and publish `client/dist`. Set `VITE_API_URL` to the API address before the build. Send every address to `index.html` so a reload on a deep link works |
| API | Any Node host such as Render, Railway or Fly.io | Start with `npm start`. Run `npm run migrate` on each release |
| Database | A managed PostgreSQL 16 | Turn on daily backups. Never run the seed on the real database |
| Email | An SMTP provider | Verification links and reminders need real email. Set `SMTP_URL` and a verified `MAIL_FROM` |

Settings for the API on the host:

- `JWT_SECRET`: a new random value of 32 characters or more. Never reuse the development one.
- `DATABASE_URL`: the managed database address.
- `CORS_ORIGINS`: the website address and nothing else.
- `APP_URL`: the website address. Email links are built from it.
- `TRUST_PROXY`: `1` when the host puts one proxy in front of the server. This makes the rate limits see each person's real address.
- `REMINDERS`: leave empty to run the reminder check inside one server. If the host runs more than one copy of the server set it to `off` and run `npm run reminders` from a scheduled job once an hour. Otherwise reminders could be sent twice.

First release checklist:

1. Create the database and run `npm run migrate`.
2. Create the first administrator by running the seed once on a private copy and moving the account or by an insert made by hand. The demo passwords must not exist in production.
3. Invite the real legal experts from the admin pages and link each to their directory entry where appropriate.
4. Have an authorized administrator check and publish the guides, entries and routes. The public pages stay empty until they do.
5. Send a test verification email and a test reminder.
6. Check the urgent help page shows the right numbers.

## Documentation

- [`server/README.md`](server/README.md): the API, its settings and the eight rules it enforces
- [`client/README.md`](client/README.md): the website, its pages and its design rules

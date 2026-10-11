# ALU Legal Companion: server

The REST API for the platform. It serves the directory of lawyers, consultants and organisations, the "Where to go" recommendations, consultations, matter tracking with reminders, verified guides, anonymous questions and the staff tools.

- **Runtime:** Node.js 20 or newer, Express 4, ES modules
- **Database:** PostgreSQL 16 with plain SQL through `pg` (no ORM)
- **Tests:** Jest and Supertest against a real database

## Set up

You need Node.js 20 or newer and a running PostgreSQL.

**1. Create the databases** (once):

```bash
psql -U postgres -c "CREATE USER alu WITH PASSWORD 'alu_dev' CREATEDB;"
psql -U postgres -c "CREATE DATABASE alu_legal OWNER alu;"
psql -U postgres -c "CREATE DATABASE alu_legal_test OWNER alu;"
```

`alu_legal` is for running the app. `alu_legal_test` is for the tests.

**2. Install and configure:**

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and set `JWT_SECRET` to a random string of at least 32 characters. Make one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The server refuses to start without it.

**3. Create the tables, add the demo data and start:**

```bash
npm run migrate
npm run seed
npm run dev        # http://localhost:4000
```

Check it with `curl http://localhost:4000/api/health`.

## Demo accounts

`npm run seed` is safe to run again. It creates these accounts, already verified:

| Role | Email | Password |
|---|---|---|
| admin | admin@example.org | dev_admin_password |
| legal_expert | expert@example.org | dev_expert_password |
| student | test.student@alustudent.com | dev_student_password |

These passwords are for local development only. Set `SEED_ADMIN_PASSWORD`, `SEED_EXPERT_PASSWORD` and `SEED_STUDENT_PASSWORD` to use others. Never use the defaults anywhere real.

The seed also adds 9 directory entries, 8 "Where to go" routes, 1 sample guide and 5 crisis contacts. **All of them are queued as `pending_review` and none is published.** The platform says a legal expert checks everything before anyone sees it so the seed does not skip that step. To see the public pages fill up, sign in as the expert and verify the entries.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the server and restarts it when a file changes |
| `npm start` | Starts the server |
| `npm run migrate` | Applies the migrations that have not run yet |
| `npm run seed` | Adds the demo data |
| `npm run reminders` | Runs one pass of the deadline reminders (for a cron job) |
| `npm test` | Runs all the tests |

## Settings

They go in `server/.env`. The template is `.env.example`.

| Name | Needed | What it is |
|---|---|---|
| `DATABASE_URL` | yes | The PostgreSQL address for the app |
| `JWT_SECRET` | yes | The secret that signs login tokens. At least 32 characters |
| `PORT` | no | The port. The default is 4000 |
| `CORS_ORIGINS` | no | The browser addresses allowed to call the API. The default is `http://localhost:5173` |
| `TRUST_PROXY` | no | Set it to the number of reverse proxies in front of the server. Leave it empty otherwise. Setting it with no proxy lets a client fake its IP address and dodge the rate limits |
| `SMTP_URL` | no | Real outgoing mail. With none, the server prints each email in its log and sends nothing |
| `MAIL_FROM` | no | The sender address. It must be one your mail provider has verified |
| `APP_URL` | no | The website address that email links point to. The default is `http://localhost:5173` |
| `REMINDERS` | no | Set it to `off` if a cron job runs `npm run reminders` instead |
| `TEST_DATABASE_URL` | no | The database for the tests. The default is `alu_legal_test` on localhost |

**Email in development.** With no `SMTP_URL` the server prints verification links, reset links and invitations in its terminal. Copy the link from there. This lets you try every flow with no mail account. The printing code refuses to run when `SMTP_URL` is set, so a live link is never written to a production log.

## How the code is organised

```text
src/
  index.js          starts the server and the reminder scheduler
  app.js            security headers, CORS, JSON errors and the routes
  db.js             the PostgreSQL connection (dates come back as plain strings)
  migrate.js        applies the migrations
  migrator.js       runs src/migrations/*.sql in order, each file once and all or nothing
  seed.js           the demo data
  run-reminders.js  one reminder pass for a cron job
  migrations/       001 to 011, one file for each step of the schema
  middleware/       auth (login and roles), rate limits, id checks
  routes/           one file for each area
  services/         mail, one-time tokens, anonymous tokens, invitations, reminders, search
tests/
  integration/      the API against a real database
  unit/             small pure functions
```

## The API

All routes are under `/api`. Every error is `{ "error": "message" }`. Login is a bearer token in the `Authorization` header.

| Area | Routes | Who |
|---|---|---|
| Health | `GET /health` | anyone |
| Accounts | `POST /auth/register` `/verify-email` `/resend-verification` `/login` `/logout` `/forgot-password` `/reset-password` `/change-password` `/redeem-invite`, `GET` and `PUT /auth/me` | see below |
| Directory | `GET /directory/providers`, staff list at `/providers/all`, `POST` and `PUT /providers`, then `/providers/:id/submit` `/verify` `/return` | public to read, admin to write, expert to verify |
| Where to go | `GET /directory/routes` (search with `?q=`), `/routes/:id`, staff list at `/routes/all`, `POST` and `PUT /routes`, then `/routes/:id/submit` `/verify` `/return` | same as the directory |
| Crisis contacts | `GET /emergency-contacts` | anyone |
| Consultations | `POST /bookings`, `POST /bookings/anonymous`, `GET /bookings/mine` `/anon/:token` `/expert`, `POST /bookings/:id/status` | student or staff, anyone, expert |
| Matters | `GET` and `POST /matters`, `GET` `PUT` `DELETE /matters/:id`, `POST /matters/:id/events`, `GET /matters/share-targets` `/shared`, `POST` and `DELETE /matters/:id/share` | student or staff, expert for shared ones |
| Guides | `GET /guides` (search with `?search=` and `?domain=`), `/guides/:id`, staff list at `/guides/all`, `POST` and `PUT /guides`, then `/guides/:id/submit` `/verify` `/return` | public to read, admin to write, expert to verify |
| Saved guides | `GET /bookmarks`, `POST` and `DELETE /guides/:id/bookmark` | student or staff |
| Questions | `POST /questions`, `POST /questions/anonymous`, `GET /questions/mine` `/anon/:token` `/open`, `POST /questions/:id/answer` | student or staff, anyone, expert |
| Admin | `/admin/invites`, `/admin/users` (role, deactivate, reactivate), `/admin/emergency-contacts`, `GET /admin/stats` | admin only |

## The rules the code enforces

These are the platform's promises. Each one has tests.

1. **Nothing reaches the public until a legal expert verifies it.** Guides, directory entries and routes go from draft to pending review to published. Only an expert publishes. The admin cannot. The database refuses a published row with no verifier.
2. **Editing a published guide takes it off the site at once.** It comes back only after an expert verifies it again. A mistaken edit is rejected before anything changes.
3. **Anonymous means anonymous.** An anonymous question or booking stores no name and no account. It stores a hash of a random token. The person gets the token once. A signed-in person who uses the anonymous route stays anonymous.
4. **Logging out really logs out.** Each token carries a session number that is checked on every request. Logging out, resetting a password and switching an account off all end the old tokens. A role change works on the next request.
5. **Matters are private.** Somebody else's matter returns 404, the same as one that does not exist. An expert sees a matter only while the owner shares it. The expert never sees who the owner is.
6. **Reminders are never late.** A reminder goes out 7 days and 1 day before a deadline. If the deadline passes first it is marked missed and not sent. The email gives the date and never the title of the matter. Dates use Kigali time.
7. **Legal experts join by invitation only.** The invitation is emailed. Registration and the role drop-down both refuse the role.
8. **Public answers list their fields one by one.** No response copies a database row, so a password hash or an account id cannot leak by accident.

## Testing

```bash
npm test
```

The tests need the `alu_legal_test` database. Each run makes its own private schema in it, applies the migrations and drops the schema at the end. Two runs at once cannot disturb each other.

Rate limits are switched off during the tests and switched on in the few files that test them.

If `npm test` stops early on a slow machine, run Jest directly:

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js
```

## Notes

- Do not commit `.env`. Only `.env.example` belongs in git.
- Accounts are switched off and never deleted. Guides and directory entries keep naming the expert who checked them.
- To add a database change, make the next numbered file in `src/migrations/`. A file runs once. Never edit one that has already been applied.

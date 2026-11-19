# ALU Legal Companion: server

The REST API for the platform. It serves the directory of lawyers, consultants and organisations, the "Where to go" recommendations, consultations, matter tracking with reminders, checked guides, anonymous questions and the staff tools.

- **Runtime:** Node.js 20 or newer, Express 4, ES modules
- **Database:** PostgreSQL 16 with plain SQL through `pg` (no ORM)
- **Tests:** Jest and Supertest against a real database
- **Live:** https://alu-legal-companion.onrender.com/api. The documentation is at https://alu-legal-companion.onrender.com/api/docs

## Hosting

The API and its database run on Render in Oregon, United States. The data is therefore stored outside Rwanda.

- The blueprint in `../render.yaml` asks for the free plan. A web service on it sleeps when nobody has used it for a while and the first request can take up to a minute. The scheduled workflow in `../.github/workflows/jobs.yml` calls the job route every ten minutes, which wakes a sleeping service.
- A database on the free plan expires about 30 days after it is made. The technical report puts the expiry of the live database at around 28 November 2026. Upgrade the database or export a backup before then.

## The live API

The API runs on Render at https://alu-legal-companion.onrender.com. The website at https://alu-legal-companion-qu8w.onrender.com is the only browser address it accepts (`CORS_ORIGINS`).

| Address | What it gives |
|---|---|
| `https://alu-legal-companion.onrender.com/api/health` | `{"status":"ok"}` when the server is running. Use it to check the server is awake |
| `https://alu-legal-companion.onrender.com/api/docs` | Swagger. Every route, who may call it and what it returns. **Try it out** sends real requests to the live server |
| `https://alu-legal-companion.onrender.com/api/openapi.json` | The same description as a file. Import it into Postman or any other tool |

To call it from Postman, set the `baseUrl` variable to `https://alu-legal-companion.onrender.com/api`. Run single read-only requests only. Do not run the whole collection against the live API. It creates records named "Postman" and signs in with the demo passwords, which do not exist there.

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

The server refuses to start without it and refuses the example values in the template.

**3. Create the tables, add the demo data and start:**

```bash
npm run migrate
NODE_ENV=development npm run seed     # PowerShell: $env:NODE_ENV='development'; npm run seed
npm run dev                           # http://localhost:4000
```

Check it with `curl http://localhost:4000/api/health`.

## Demo accounts

`npm run seed` is safe to run again. An account that exists is left as it is. Unless `NODE_ENV` is `development` or `test`, the seed needs the three `SEED_*_PASSWORD` values set, each at least 12 characters and not a public default. For a local demo run use `NODE_ENV=development npm run seed`. It creates these accounts, already verified:

| Role | Email | Password |
|---|---|---|
| admin | admin@example.org | dev_admin_password |
| legal_expert | expert@example.org | dev_expert_password |
| student | test.student@alustudent.com | dev_student_password |

These passwords are for local development only. Set `SEED_ADMIN_PASSWORD`, `SEED_EXPERT_PASSWORD` and `SEED_STUDENT_PASSWORD` to use others. Never use the defaults anywhere real.

The seed adds directory entries, "Where to go" routes, dispute ladder steps, guides and document checklists. **Every legal-information record begins as a draft and none is published.** The seed never publishes. To see public pages fill up, sign in as an administrator and publish the records.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the server and restarts it when a file changes |
| `npm start` | Starts the server. This is the start command on Render |
| `npm run migrate` | Applies the migrations that have not run yet. Render runs it before each deploy |
| `npm run seed` | Adds the starter accounts and draft records. Publishes nothing |
| `npm run reminders` | Runs one pass of the scheduled jobs (deadline reminders, consultation reminders and the clean-up of old records), prints the counts and exits. For a cron job, with `REMINDERS=off` on the server |
| `npm run evaluate:routing` | Scores the situations in `../docs1/routing-test-set.json` against the "Where to go" search and prints the share sent to the right first body. It reads the database and writes nothing |
| `npm test` | Runs the tests |

**Running the tests on Windows.** A run of many test files at once can stop early with no summary. Run them in batches of five files, passing the files after `--` so the ES module flag is kept:

```bash
npm test -- tests/integration/a.test.js tests/integration/b.test.js tests/unit/c.test.js
```

`npx jest` on its own does not set `--experimental-vm-modules`, so use `npm test` for the batches.

## Settings

They go in `server/.env`. The template is `.env.example`. Names only; never commit a value.

"In render.yaml" means the blueprint lists the setting. `sync: false` means it is typed into the Render dashboard and is not stored in the file.

| Name | Required | Default | What it does | In render.yaml |
|---|---|---|---|---|
| `DATABASE_URL` | yes | none | The PostgreSQL address of the app database | yes (dashboard) |
| `JWT_SECRET` | yes | none | Signs login tokens. At least 32 characters. The server refuses a short value and the example values | yes (generated) |
| `NODE_ENV` | on a live server | unset | `production` turns on the production checks: `APP_URL` and `CORS_ORIGINS` are required and an email link is never printed. `development` or `test` allows the demo seed passwords | yes (`production`) |
| `PORT` | no | 4000 | The port the server listens on | no |
| `CORS_ORIGINS` | yes in production | `http://localhost:5173` outside production | The browser addresses allowed to call the API, comma separated. In production the server refuses to start without it | yes (dashboard) |
| `APP_URL` | yes in production | `http://localhost:5173` outside production | The website address that email links are built from. In production the server stops at start-up without it | yes (dashboard) |
| `TRUST_PROXY` | no | off | The number of reverse proxies in front of the server (`1`), or `true` or `false`. Set it only behind a real proxy, or a client can fake its address and dodge the rate limits | yes (`1`) |
| `SMTP_URL` | no | empty | Outgoing mail. Port 587 uses `smtp://` and port 465 uses `smtps://`. With none, the server prints each message in its log and sends nothing | yes (dashboard) |
| `MAIL_FROM` | no | `ALU Legal Companion <no-reply@alu-legal.invalid>` | The sender address. It must be one your mail provider has verified | yes (dashboard) |
| `MAIL_FROM_NAME` | no | ALU Legal Companion | The name shown before a bare sender address | yes (`ALU Legal Companion`) |
| `MAIL_REPLY_TO` | no | the sender address | Where replies go | yes (dashboard) |
| `DAILY_EMAIL_BUDGET` | no | 180 | How many optional emails a day (Kigali time) may be sent. Essential mail is always sent | yes (`180`) |
| `JOB_SECRET` | no | off | At least 32 characters. Switches on `POST /api/internal/run-jobs`. Shorter or empty, the route answers 404 | yes (dashboard) |
| `REMINDERS` | no | on | `off` stops the timer inside the server. Use it only with a cron job that runs `npm run reminders` | no |
| `DOCUMENT_KEY` | for uploads | none | 64 hex characters. Encrypts the files attached to a matter. With none, uploads answer 503. Losing it loses every stored file | yes (dashboard) |
| `REDIS_URL` | no | none | Keeps the rate limits in Redis so several server processes share them. With none the limits live in the process's memory | no |
| `CALL_TICKET_SECRET` | for calls inside the platform | none | At least 32 characters. Signs call tickets. The same value must be set on the Worker | yes (dashboard) |
| `CALL_SIGNAL_URL` | for calls inside the platform | none | The Worker address. It must start with `wss://` | yes (dashboard) |
| `CALL_TURN_KEY_ID` | no | none | A Cloudflare Realtime TURN key id. With it a call can use a relay when a direct connection is blocked | yes (dashboard) |
| `CALL_TURN_API_TOKEN` | no | none | The API token for that TURN key. Without the key pair the call uses the free STUN address only | yes (dashboard) |
| `DAILY_API_KEY` | no | none | Daily API key. Used for a consultation room when the platform's own call is not set up. Needs `DAILY_DOMAIN` too | no |
| `DAILY_DOMAIN` | no | none | The subdomain of the Daily account, the part before `.daily.co` | no |
| `VIDEO_ROOMS_PER_DAY` | no | 20 | The most new Daily rooms made in one day (Kigali time). `0` uses only the Meet link | no |
| `DAILY_API_BASE` | no | `https://api.daily.co/v1` | The Daily API address. Leave it empty except in tests | no |
| `GEMINI_API_KEY` | for Ask AI | none | Google Gemini key. Ask AI says it is not available without it | yes (dashboard) |
| `GEMINI_MODEL` | for Ask AI | none | The model id, sent to Google as written. Letters, digits, dots and hyphens only | yes (dashboard) |
| `GEMINI_API_BASE` | no | `https://generativelanguage.googleapis.com` | The Gemini API address. Leave it empty except in tests | no |
| `ASK_AI_DAILY_LIMIT` | no | 200 | The most questions sent to the model in one day (UTC). The count is kept in memory and restarts at zero | yes (`200`) |
| `SEED_ADMIN_PASSWORD`, `SEED_EXPERT_PASSWORD`, `SEED_STUDENT_PASSWORD` | for the seed outside development | none | The passwords the seed gives the three starter accounts. At least 12 characters | yes (dashboard) |
| `TEST_DATABASE_URL` | for the tests | `postgres://alu:<PGPASSWORD or alu_dev>@localhost:5432/alu_legal_test` | The database the tests use | no |

Two notes:

- The test run sets `ALU_TEST_SCHEMA` and `RATE_LIMIT_TEST`. The server reads them only to use the test schema and to switch the rate limits on in tests. Leave them unset on a live server.
- `DOCUMENTS_DIR` is not read by the server. Uploaded matter files are encrypted and kept in the database.

**Email in development.** With no `SMTP_URL` the server prints verification links, reset links and invitations in its terminal. Copy the link from there. This lets you try every flow with no mail account. The printing code refuses to run when `SMTP_URL` is set, so a live link is never written to a production log.

**Optional and essential mail.** Essential mail always goes: sign-in and verification, password reset, email change, invitations, report replies and the notice that a lawyer accepted a consultation. Optional mail counts against `DAILY_EMAIL_BUDGET` and stops once the day's budget is used. Optional mail is the deadline and consultation reminders, the notice that a document changed, the notice that a lawyer checked or commented on a document and the new-request, declined, cancelled, suggested-time and time-changed notices. A failed send gives its place in the budget back.

**Changing your email address.** A signed-in person sends the new address and their current password to `POST /api/auth/change-email`. The new address waits in `users.pending_email` and the account keeps its old address until the link sent to the new one is used at `POST /api/auth/confirm-email-change`. A typo therefore cannot lock anyone out. Students and staff must stay on the ALU domains, legal experts can use any address. The reply is the same whether or not the new address already has an account, so nobody can use it to find out who is registered. The old address gets a short notice with no link and the new address is only partly shown in it. Using the link makes the new address the account's address, counts it as verified, ends every older session and signs this one in again. Asking again cancels the earlier link. A wrong password answers 400, not 401, so the website does not sign the person out over a typo.

**Email that says something changed.** A signed-in person gets an email when a lawyer accepts their consultation, with the time and the meeting link. A lawyer gets one when the owner adds, replaces or removes a document on a matter shared with them and the owner gets one when the lawyer comments on or checks a document. Each says only that something changed and where to look. It never carries a comment, a document name, a matter title or who the owner is. A person who booked anonymously has no address and gets nothing. A burst of uploads sends the lawyer one email in five minutes. A failed send is logged without the address and never fails the request. The code is `src/services/notify.js`. Nothing depends on an email arriving. The lawyer's list of shared matters (`GET /api/matters/shared`) also carries `documents_waiting`, the number of files on each matter that wait for a check and the page shows it.

## Jobs and clean-up

Three jobs run together: deadline reminders, consultation reminders and the clean-up of old records. `src/services/dueJobs.js` runs them in that order and each one runs on its own, so one that fails does not stop the others.

Three things start them:

- **The timer inside the server** runs every ten minutes while the process is awake. It is on unless `REMINDERS=off`.
- **The job route** `POST /api/internal/run-jobs` takes the header `X-Job-Secret`. A wrong secret answers 401. The route answers 404 when `JOB_SECRET` is unset or shorter than 32 characters. It returns counts only. The GitHub workflow calls it every ten minutes.
- **`npm run reminders`** runs one pass and exits, for a cron job.

Every pass takes its own lock, so two passes never send the same reminder.

The clean-up deletes only records that have no account:

- Anonymous questions answered more than 90 days ago. An answered question with no answer time kept is judged by its creation date. An anonymous question with no answer is kept, however old it is.
- Anonymous bookings whose slot was more than 90 days ago, whatever their status.
- One-time link tokens (email checks, password resets and invitations) 30 days after they expired or were used.

Signed-in questions, bookings, reports, matters and accounts are never deleted by the clean-up.

## Reminders

A deadline reminder goes out 7 days and 1 day before a matter's deadline. If the deadline has passed first, the reminder is marked missed and is not sent late. Dates are Kigali dates. The email gives the date and never the matter title.

## Server behaviour

- **Start-up.** The server stops if `JWT_SECRET` is missing or weak and in production if `APP_URL` is empty or `CORS_ORIGINS` is empty.
- **Shutdown.** On `SIGTERM` or `SIGINT` the server stops the timer, takes no new connections, finishes running requests, closes the database pool and exits. After 10 seconds it exits anyway.
- **Database.** A connection that cannot be made within 10 seconds fails. A `DATE` column comes back as a plain `YYYY-MM-DD` string, not a JavaScript date, so a deadline does not shift by a day.
- **Migrations.** `src/migrations/` holds 42 files, `001` to `042`. Each runs once, in order, all or nothing. `041` moves the files attached to matters into PostgreSQL. `042` adds indexes. Never edit a file that has already run. Add the next numbered file.
- **Seed.** The seed publishes nothing. Every record it adds is a draft.

## How the code is organised

```text
src/
  index.js          starts the server, the timer and the shutdown handling
  app.js            security headers, CORS, JSON errors and the routes
  openapi.js        the API description that Swagger shows at /api/docs
  db.js             the PostgreSQL connection (dates come back as plain strings)
  migrate.js        applies the migrations
  migrator.js       runs src/migrations/*.sql in order, each file once and all or nothing
  seed.js           the demo data, all as drafts
  run-reminders.js  one pass of the scheduled jobs for a cron job
  evaluate-routing.js  the routing score for npm run evaluate:routing
  migrations/       001 to 042, one file for each step of the schema
  middleware/       auth (login and roles), rate limits, id checks
  routes/           one file for each area
  services/         mail and email notices, the job runner, reminders, retention, call tickets,
                    video rooms, encrypted documents, Ask AI, routing, anonymous and one-time tokens
tests/
  integration/      the API against a real database
  unit/             small pure functions
```

## Explore the API

**Swagger.** Start the server and open `http://localhost:4000/api/docs`. It lists every route with who may call it, what it takes and what it returns and each one can be tried from the page. Choose Authorize and paste the token that `POST /auth/login` gives. The description is at `/api/openapi.json`. It is written in `src/openapi.js`. The page is public and read only. It holds no data.

**Postman.** Two collections sit next to this file.

- `ALU_Legal_Companion.postman_collection.json` runs every route in an order that builds on itself and checks each answer. Import it with `ALU_Legal_Companion.local.postman_environment.json`, or run it with Newman: `npx newman run ALU_Legal_Companion.postman_collection.json -e ALU_Legal_Companion.local.postman_environment.json`. Run it on a development database only. It creates records named "Postman" and it signs in with the default demo passwords, so seed with `NODE_ENV=development` and without `SEED_*_PASSWORD` set. Set `DOCUMENT_KEY` on the server first, or the upload checks say they were skipped. The email change has refusal checks only. Its success path needs the link from the email, so the collection never sends one.
- `ALU_Legal_Companion.admin-content-workflow.postman_collection.json` is the short administrator workflow: create, publish and withdraw.

## The API

All routes are under `/api`. Every error is `{ "error": "message" }`. Login is a bearer token in the `Authorization` header.

| Area | Routes | Who |
|---|---|---|
| Health | `GET /health` | anyone |
| Accounts | `POST /auth/register` `/verify-email` `/resend-verification` `/login` `/logout` `/forgot-password` `/reset-password` `/change-password` `/change-email` `/confirm-email-change` `/redeem-invite`, `GET` `PUT` and `DELETE /auth/me` (delete erases the account), `GET /auth/mail-status` | see the rules below |
| Directory | `GET /directory/providers`, staff list at `/providers/all`, `GET /providers/:id`, `POST` and `PUT /providers`, then `/providers/:id/publish` | public to read; administrator writes and publishes |
| Where to go | `GET /directory/routes` (search with `?q=`), `/routes/:id`, staff list at `/routes/all`, `POST` and `PUT /routes`, then `/routes/:id/publish` | public to read; administrator writes and publishes |
| Dispute ladder | `GET /directory/ladder`, staff list at `/ladder/all`, `POST` and `PUT /ladder/:id`, `DELETE /ladder/:id`, then `/ladder/:id/publish` | public to read; administrator writes and publishes |
| Crisis contacts | `GET /emergency-contacts` | anyone |
| Search | `GET /search?q=` (add `&library=guides`, `routes` or `providers`) | anyone |
| Ask AI | `GET /ask-ai/status`, `POST /ask-ai` | anyone; answers only from published guides |
| Consultation hours | `GET` and `PUT /bookings/availability` (the lawyer's own hours), `GET /bookings/slots/:providerId` | lawyer for their own hours; slots are public |
| Consultations | `POST /bookings`, `POST /bookings/anonymous`, `GET /bookings/mine` `/expert`, `POST /bookings/anon/status`, `POST /bookings/anon/cancel`, `POST /bookings/:id/status`, `POST /bookings/:id/cancel`, `POST /bookings/:id/join` | student or staff, anyone, expert |
| Consultation changes | `POST /bookings/:id/propose`, `/proposal`, `/reschedule`, `POST /bookings/anon/proposal`, `/anon/reschedule` | the lawyer, the person who booked |
| Matters | `GET` and `POST /matters`, `GET` `PUT` `DELETE /matters/:id`, `POST /matters/:id/events`, `GET /matters/share-targets` `/shared` `/reminders` `/progress`, `POST` and `DELETE /matters/:id/share`, `POST` and `DELETE /matters/:id/checklist`, the event files under `/matters/:id/events/:eventId` | student or staff, expert for shared ones |
| Matter documents | Under `/matters/:id/documents`: `GET` and `POST /`, `GET /checklist`, `GET /:docId/file`, `DELETE /:docId`, `PUT /:docId/review`, `POST /:docId/comments` | the owner; the expert a matter is shared with can read, check and comment |
| Guides | `GET /guides` (search with `?search=` and `?domain=`), `/guides/:id`, staff list at `/guides/all`, `POST` and `PUT /guides/:id`, then `/guides/:id/publish` or `/guides/:id/withdraw` | public to read; administrator writes, publishes and withdraws |
| Saved guides | `GET /bookmarks`, `POST` and `DELETE /guides/:id/bookmark` | student or staff |
| Checklists | `GET /checklists`, `/checklists/:id`, staff list at `/checklists/all`, `POST` and `PUT /checklists/:id`, then `/checklists/:id/publish` | public to read; administrator writes and publishes |
| Questions | `POST /questions`, `POST /questions/anonymous`, `GET /questions/mine` `/open` `/summary`, `POST /questions/anon/status`, `POST /questions/:id/answer` | student or staff, anyone, expert |
| Reports | `POST /reports` (a problem report), `POST /reports/check` (check a report by its code) | anyone |
| Admin | `/admin/invites` (`GET` and `POST`), `/admin/users` (list, role, deactivate, reactivate), `/admin/emergency-contacts` (list, add, edit, delete), `/admin/bookings`, `GET /admin/stats`, `/admin/reports` (list, export, one report, update) | admin only |
| Internal | `POST /internal/run-jobs` | the job secret only |

## The rules the code enforces

These are the platform's promises. [`../docs1/TEST_PLAN.md`](../docs1/TEST_PLAN.md) shows which of them the current tests check.

1. **Nothing reaches the public until an administrator has checked and published it.** Guides, directory entries and routes go from draft to published. Only an administrator publishes. The database refuses a published row with no publisher.
2. **Editing a published guide takes it off the site at once.** It comes back only after an administrator publishes it again. A mistaken edit is rejected before anything changes.
3. **Anonymous.** An anonymous question or booking stores no name and no account. It stores a hash of a random token. The person gets the token once. A signed-in person who uses the anonymous route stays anonymous.
4. **Logging out.** Each token carries a session number that is checked on every request. Logging out, resetting a password and switching an account off all end the old tokens. A role change works on the next request.
5. **Matters are private.** Somebody else's matter returns 404, the same as one that does not exist. An expert sees a matter only while the owner shares it. The expert never sees who the owner is.
6. **Reminders are never late.** A reminder goes out 7 days and 1 day before a deadline. If the deadline passes first it is marked missed and not sent. The email gives the date and never the title of the matter. Dates use Kigali time.
7. **Legal experts join by invitation only.** The invitation is emailed. Registration and the role drop-down both refuse the role.
8. **Public answers list their fields one by one.** No response copies a database row, so a password hash or an account id cannot leak by accident.

## Testing

```bash
npm test
```

The tests need the `alu_legal_test` database, or the one in `TEST_DATABASE_URL`. Each run makes its own private schema in it, applies the migrations and drops the schema at the end. Two runs at once cannot disturb each other.

Rate limits are switched off during the tests.

On Windows run the tests in batches of five files. See Scripts above. CI runs `npm test` on Linux against a Postgres 16 service (`../.github/workflows/ci.yml`).

## Notes

- Do not commit `.env`. Only `.env.example` belongs in git.
- Accounts are switched off and never deleted. Guides and directory entries keep the account of the administrator who published them.
- To add a database change, make the next numbered file in `src/migrations/`. A file runs once. Never edit one that has already been applied.

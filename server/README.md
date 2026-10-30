# ALU Legal Companion: server

The REST API for the platform. It serves the directory of lawyers, consultants and organisations, the "Where to go" recommendations, consultations, matter tracking with reminders, checked guides, anonymous questions and the staff tools.

- **Runtime:** Node.js 20 or newer, Express 4, ES modules
- **Database:** PostgreSQL 16 with plain SQL through `pg` (no ORM)
- **Tests:** Jest and Supertest against a real database
- **Live:** https://alu-legal-companion.onrender.com/api. The documentation is at https://alu-legal-companion.onrender.com/api/docs

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

The seed adds directory entries, "Where to go" routes, a sample guide and crisis contacts. **The legal-information records begin as drafts and none is published.** To see public pages fill up, sign in as an authorized administrator and publish the entries.

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
| `NODE_ENV` | on a live server | Set it to `production`. The server then refuses to start with no `CORS_ORIGINS` and never prints an email link in its log |
| `DOCUMENT_KEY` | for uploads | 64 hex characters that encrypt the documents attached to a matter. With none, uploads answer 503. If it is lost, every stored document is lost |
| `REDIS_URL` | no | Keeps the rate limits in Redis so more than one copy of the server shares them. With none they are kept in the server's memory, which is fine for one copy |
| `SEED_ADMIN_PASSWORD`, `SEED_EXPERT_PASSWORD`, `SEED_STUDENT_PASSWORD` | no | The passwords the seed gives the demo accounts. The defaults are for local use only. Set your own before seeding a live database |
| `TEST_DATABASE_URL` | no | The database for the tests. The default is `alu_legal_test` on localhost |

**Email in development.** With no `SMTP_URL` the server prints verification links, reset links and invitations in its terminal. Copy the link from there. This lets you try every flow with no mail account. The printing code refuses to run when `SMTP_URL` is set, so a live link is never written to a production log.

**Changing your email address.** A signed-in person sends the new address and their current password to `POST /api/auth/change-email`. The new address waits in `users.pending_email` and the account keeps its old address until the link sent to the new one is used at `POST /api/auth/confirm-email-change`. A typo therefore cannot lock anyone out. Students and staff must stay on the ALU domains, legal experts can use any address. The reply is the same whether or not the new address already has an account, so nobody can use it to find out who is registered. The old address gets a short notice with no link and the new address is only partly shown in it. Using the link makes the new address the account's address, counts it as verified, ends every older session and signs this one in again. Asking again cancels the earlier link. A wrong password answers 400, not 401, so the website does not sign the person out over a typo.

**Email that says something changed.** A signed-in person gets an email when a lawyer accepts their consultation, with the time and the meeting link. A lawyer gets one when the owner adds, replaces or removes a document on a matter shared with them, and the owner gets one when the lawyer comments on or checks a document. Each says only that something changed and where to look. It never carries a comment, a document name, a matter title or who the owner is. A person who booked anonymously has no address and gets nothing. A burst of uploads sends the lawyer one email in five minutes. A failed send is logged without the address and never fails the request. The code is `src/services/notify.js`. Nothing depends on an email arriving. The lawyer's list of shared matters (`GET /api/matters/shared`) also carries `documents_waiting`, the number of files on each matter that wait for a check and the page shows it.

## How the code is organised

```text
src/
  index.js          starts the server and the reminder scheduler
  app.js            security headers, CORS, JSON errors and the routes
  openapi.js        the API description that Swagger shows at /api/docs
  db.js             the PostgreSQL connection (dates come back as plain strings)
  migrate.js        applies the migrations
  migrator.js       runs src/migrations/*.sql in order, each file once and all or nothing
  seed.js           the demo data
  run-reminders.js  one reminder pass for a cron job
  migrations/       001 to 025, one file for each step of the schema
  middleware/       auth (login and roles), rate limits, id checks
  routes/           one file for each area
  services/         mail and email notices, one-time tokens, anonymous tokens, invitations, reminders, search, guides, checklists, encrypted documents
tests/
  integration/      the API against a real database
  unit/             small pure functions
```

## Explore the API

**Swagger.** Start the server and open `http://localhost:4000/api/docs`. It lists every route with who may call it, what it takes and what it returns, and each one can be tried from the page. Choose Authorize and paste the token that `POST /auth/login` gives. The raw description is at `/api/openapi.json`. It is written in `src/openapi.js`. The test `tests/integration/openapi.test.js` fails when a route is added or removed and that file is not updated. The page is public and read only. It holds no data.

**Postman.** Two collections sit next to this file.

- `ALU_Legal_Companion.postman_collection.json` runs every route in an order that builds on itself and checks each answer. Import it with `ALU_Legal_Companion.local.postman_environment.json`, or run it with Newman: `npx newman run ALU_Legal_Companion.postman_collection.json -e ALU_Legal_Companion.local.postman_environment.json`. Run it on a development database only. It creates records named "Postman" and it signs in with the default demo passwords, so seed without `SEED_*_PASSWORD` set. Set `DOCUMENT_KEY` on the server first, or the upload checks say they were skipped. The email change has refusal checks only. Its success path needs the link from the email, so the collection never sends one.
- `ALU_Legal_Companion.admin-content-workflow.postman_collection.json` is the short administrator workflow: create, publish and withdraw.

## The API

All routes are under `/api`. Every error is `{ "error": "message" }`. Login is a bearer token in the `Authorization` header.

| Area | Routes | Who |
|---|---|---|
| Health | `GET /health` | anyone |
| Accounts | `POST /auth/register` `/verify-email` `/resend-verification` `/login` `/logout` `/forgot-password` `/reset-password` `/change-password` `/change-email` `/confirm-email-change` `/redeem-invite`, `GET` and `PUT /auth/me` | see below |
| Directory | `GET /directory/providers`, staff list at `/providers/all`, `POST` and `PUT /providers`, then `/providers/:id/publish` | public to read; administrator writes and publishes |
| Where to go | `GET /directory/routes` (search with `?q=`), `/routes/:id`, staff list at `/routes/all`, `POST` and `PUT /routes`, then `/routes/:id/publish` | public to read; administrator writes and publishes |
| Crisis contacts | `GET /emergency-contacts` | anyone |
| Search | `GET /search?q=` (add `&library=guides`, `routes` or `providers`) | anyone |
| Consultations | `POST /bookings`, `POST /bookings/anonymous`, `GET /bookings/mine` `/anon/:token` `/expert`, `POST /bookings/:id/status` | student or staff, anyone, expert |
| Matters | `GET` and `POST /matters`, `GET` `PUT` `DELETE /matters/:id`, `POST /matters/:id/events`, `GET /matters/share-targets` `/shared`, `POST` and `DELETE /matters/:id/share`, `POST` and `DELETE /matters/:id/checklist` | student or staff, expert for shared ones |
| Guides | `GET /guides` (search with `?search=` and `?domain=`), `/guides/:id`, staff list at `/guides/all`, `POST` and `PUT /guides`, then `/guides/:id/publish` or `/guides/:id/withdraw` | public to read; administrator writes, publishes, and withdraws |
| Saved guides | `GET /bookmarks`, `POST` and `DELETE /guides/:id/bookmark` | student or staff |
| Checklists | `GET /checklists`, `/checklists/:id`, staff list at `/checklists/all`, `POST` and `PUT /checklists`, then `/checklists/:id/publish` | public to read; administrator writes and publishes |
| Matter documents | `GET` and `POST /matters/:id/documents`, `GET /documents/checklist`, `GET /documents/:docId/file`, `DELETE /documents/:docId`, `PUT /documents/:docId/review`, `POST /documents/:docId/comments` | the owner; the expert a matter is shared with can read, check and comment |
| Questions | `POST /questions`, `POST /questions/anonymous`, `GET /questions/mine` `/anon/:token` `/open`, `POST /questions/:id/answer` | student or staff, anyone, expert |
| Admin | `/admin/invites`, `/admin/users` (role, deactivate, reactivate), `/admin/emergency-contacts`, `GET /admin/stats` | admin only |

## The rules the code enforces

These are the platform's promises. Each one has tests.

1. **Nothing reaches the public until an administrator has checked and published it.** Guides, directory entries and routes go from draft to published. Only an administrator publishes. The database refuses a published row with no publisher.
2. **Editing a published guide takes it off the site at once.** It comes back only after an administrator publishes it again. A mistaken edit is rejected before anything changes.
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
- Accounts are switched off and never deleted. Guides and directory entries keep the account of the administrator who published them.
- To add a database change, make the next numbered file in `src/migrations/`. A file runs once. Never edit one that has already been applied.

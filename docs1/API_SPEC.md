# API specification

The base path is `/api`. Every request and reply is JSON. The server README has a shorter table. This page gives the detail: who may call each route, what it takes and what it returns.

## The basics

- **Login.** Send `Authorization: Bearer <token>`. The token comes from `POST /auth/login`. The server reads the person's role from the database on every request. The token only proves who they are.
- **Errors.** Every error is `{ "error": "a sentence a person can act on" }`. There are no stack traces.
- **Status codes.**

| Code | Meaning |
|---|---|
| 400 | The input is wrong. The message says how |
| 401 | There is no login or the session has ended. The website clears its saved login |
| 403 | The login is fine but the role or the account state is not allowed. The website keeps its login |
| 404 | Not found. It is also the answer for a private record that belongs to someone else |
| 409 | A clash, for example two accepted bookings at one time |
| 429 | Too many requests. A `Retry-After` header says how long to wait |

- **Who.** In the tables below "anyone" needs no login. "Student or staff" means a signed-in student or staff member. "Expert" is a legal expert. "Admin" is an administrator. A legal expert holds consultations and reads the matters shared with them — they do not publish or verify guides, directory entries or routes. Only the admin does that.
- **Dates.** A `DATE` is written `YYYY-MM-DD`. A moment in time is an ISO 8601 text such as `2027-03-01T10:00:00.000Z`.

## Rate limits

| Applies to | Limit |
|---|---|
| Sign in, counted for each email address | 10 failed tries in 15 minutes. A good sign in does not count |
| Routes that send email, counted for each email address | 5 in 15 minutes |
| Every account route, counted for each IP address | 100 in 15 minutes |
| Anonymous questions and bookings, for each IP address | 30 in an hour |
| Looking up an anonymous code, for each IP address | 100 in 15 minutes |
| Search, for each IP address | 120 in 15 minutes |

## Publishing

Guides, directory entries, routes and document checklists share one life cycle. There is no second-person review: the admin writes a record and the admin publishes it.

```
draft  --publish (admin)-->  published
```

- Only `published` rows reach the public routes.
- `publish` stamps `verified_by` and `verified_at` with the admin's own id and the time. The database refuses a published row without them — the column names are historical, from when a legal expert did the verifying, but it is always the admin now.
- Editing a published guide, route or checklist sends it back to `draft` and clears the stamp. Editing a published directory entry does the same only when a checked fact changes. Those are the name, kind, place, contact, services, languages, cost and source.
- Each of the four has `POST <path>/:id/publish`, admin only. It takes no body and answers 400 if the record is already published or does not exist.
- A guide can also be taken off the site once published: `POST /guides/:id/withdraw` (admin only, `{ "comment": "why" }` required) sets it to `withdrawn`. Editing it and publishing again brings it back.
- A legal expert holds no CMS access of any kind here — they hold consultations (`/bookings`) and read the matters shared with them (`/matters`), nothing more.

## Health

| Route | Who | Reply |
|---|---|---|
| `GET /health` | anyone | `{ "status": "ok" }` |

## Accounts (`/auth`)

| Route | Who | Takes | Returns |
|---|---|---|---|
| `POST /auth/register` | anyone | `name`, `email`, `password` (8 or more), `role` (`student` or `staff`) | 201 `{ user, message }`. No login is given. The email must end in `@alustudent.com` or `@alueducation.com` |
| `POST /auth/verify-email` | anyone | `token` | `{ token, user }`. This signs the person in |
| `POST /auth/resend-verification` | anyone | `email` | The same `{ message }` for every address |
| `POST /auth/login` | anyone | `email`, `password` | `{ token, user }`. 401 for an unknown address or a wrong password, with the same words. 403 when the address is not verified or the account is switched off |
| `POST /auth/logout` | signed in | | 204. Ends every session of the account |
| `GET /auth/me` | signed in | | `{ id, name, email, role, email_verified_at, created_at }` |
| `PUT /auth/me` | signed in | `name` | `{ token, user }`. Only the name is read |
| `POST /auth/change-password` | signed in | `current_password`, `new_password` | `{ token, user }`. 400 for a wrong current password. Ends the other sessions |
| `POST /auth/forgot-password` | anyone | `email` | The same `{ message }` for every address |
| `POST /auth/reset-password` | anyone | `token`, `password` | `{ token, user }`. Ends every older session |
| `POST /auth/redeem-invite` | anyone | `invite_token`, `name`, `password` | 201 `{ token, user }`. The only way to become a legal expert |

`user` is always `{ id, name, email, role }`.

## Directory (`/directory`)

| Route | Who | Takes | Returns |
|---|---|---|---|
| `GET /directory/providers` | anyone | `?category=` `?type=` `?free=true` `?q=` | Published entries. Each has `id`, `name`, `category`, `type`, `location`, `contact`, `services`, `languages`, `is_free`, `bookable`, `official_source_url`, `last_checked_at`, `verified_at`, `verified_by_name` and `stale`. Bookable entries come first |
| `GET /directory/providers/:id` | anyone | | One published entry with the same fields as the list. 404 for a draft entry, an unknown id and a word. It never returns `user_id` or `meet_link` |
| `GET /directory/providers/all` | admin | | Every entry in every state with `status`, `user_id` and `meet_link` |
| `POST /directory/providers` | admin | `name`, `category`, `type`, `location`, `contact`, `services`, `languages`, `is_free`, `official_source_url`, `user_id`, `bookable`, `meet_link` | 201 the new entry as a draft |
| `PUT /directory/providers/:id` | admin | The same fields. A key that is left out keeps its value. A key sent as `null` is cleared | The entry |
| `POST /directory/providers/:id/publish` | admin | | The entry, published and stamped. 400 if it does not exist or is already published |

`meet_link` must be an `https://meet.google.com/` address. A new entry is always a draft.

## Where to go (`/directory/routes`)

| Route | Who | Takes | Returns |
|---|---|---|---|
| `GET /directory/routes` | anyone | `?q=` words from the reader, `?area=` one of `tenancy` `employment` `business` `immigration` `harassment` `vehicles` | Published routes whose first office is also published. Each has `id`, `matter_type`, `title`, `area`, `deadline_days`, `deadline_runs_from`, `first_forum_id`, `first_forum_name`, `first_forum_type`, `verified_by_name`, `verified_at` and `score`. The name and date say who checked the route and when, and nothing else about that person is sent. With `q` the best match comes first. An unknown `area` is ignored |
| `GET /directory/routes/:id` | anyone | | The whole route: `title`, `legal_basis`, `exclusions`, `steps`, the deadline fields, `verified_by_name`, `verified_at` and `first_forum`. 404 if the route or its office is not published |
| `GET /directory/routes/all` | admin | | Every route in every state with `area`, `first_forum_name` and `first_forum_status` |
| `POST /directory/routes` | admin | `matter_type`, `title`, `keywords`, `first_forum_id`, `legal_basis`, `exclusions`, `steps` (a list), `deadline_days`, `deadline_runs_from`, `deadline_note`, `area` (one of the six areas, or empty for none. 400 for any other value) | 201 the route as a draft. 409 if the `matter_type` exists |
| `PUT /directory/routes/:id` | admin | The same fields | The route as a draft. Every field is a checked fact so any edit sends it back |
| `POST /directory/routes/:id/publish` | admin | | The route, published and stamped. 400 if it does not exist or is already published |

A deadline needs both `deadline_days` and `deadline_runs_from`. Or neither.

## Search (`/search`)

| Route | Who | Takes | Returns |
|---|---|---|---|
| `GET /search` | anyone | `?q=` 2 to 100 characters, `?library=` `all` (the default) `guides` `routes` or `providers` | `{ query, results }`. `results` holds one list for each library asked for, at most 6 each. A guide has `id`, `title`, `summary`, `domain`, `source_law`. A route has `id`, `title`, `first_forum_name`. A directory entry has `id`, `name`, `type`, `location`, `services`. Published items only: a draft and a route whose first office is not published never appear. Every word must be found. `%`, `_` and `\` are plain characters. Nothing about who asked or what they typed is stored. 400 for a short or long `q` or an unknown `library` |

## Crisis contacts

| Route | Who | Returns |
|---|---|---|
| `GET /emergency-contacts` | anyone | `[{ name, contact, when }]`. If the table is empty or the database fails the server sends a built-in list. This route is never empty |

## Consultations (`/bookings`)

| Route | Who | Takes | Returns |
|---|---|---|---|
| `POST /bookings` | student or staff | `provider_id`, `slot` (in the future and within a year), `topic` (500 characters or fewer) | 201 `{ id, provider_id, slot, topic, status, created_at }`. The entry must be published and bookable |
| `POST /bookings/anonymous` | anyone | The same | 201 the booking plus `anon_token` and a `warning`. The token is shown once. No account is stored. A login is ignored |
| `GET /bookings/mine` | student or staff | | The person's bookings with `provider_name` and `meet_link` |
| `GET /bookings/anon/:token` | anyone | | `{ id, slot, topic, status, provider_name, meet_link }`. 404 for an unknown or badly formed code |
| `GET /bookings/expert` | expert | | The bookings for the entry linked to the expert's account. `requester` is `Anonymous` or the person's name |
| `POST /bookings/:id/status` | expert | `status` | The booking. A booking only moves forward: requested to accepted or declined, accepted to completed or declined. 409 for a clash |

`meet_link` is sent only when the status is `accepted`. The three reads share one rule so they cannot differ.

## Matters (`/matters`)

A matter is private to its owner. Someone else's matter gives 404.

| Route | Who | Takes | Returns |
|---|---|---|---|
| `GET /matters` | student or staff | | The person's matters. The soonest deadline first and finished ones last |
| `POST /matters` | student or staff | Either `title`, `next_action`, `next_due`. Or `route_id` with an optional `title`, `next_action` and `deadline_start` | 201 the matter. With `deadline_start` the server works out `next_due` from the route's days. It makes the reminders |
| `GET /matters/share-targets` | student or staff | | The published entries that have an expert account |
| `GET /matters/shared` | expert | | The matters shared with the expert's entry. The owner is not named |
| `GET /matters/:id` | owner or an expert while it is shared | | The matter, `viewer` (`owner` or `expert`), `events` and, for the owner only, `reminders` |
| `PUT /matters/:id` | owner | `title`, `next_action`, `next_due`, `status` (`open` or `closed`) | The matter. A new date replaces the reminders. Closing cancels them |
| `POST /matters/:id/events` | owner or an expert while it is shared | `description`, `occurred_on` (not in the future) | 201 the entry |
| `POST /matters/:id/share` | owner | `provider_id` | The matter. It replaces any earlier share |
| `DELETE /matters/:id/share` | owner | | The matter. The expert's access ends on their next request |
| `DELETE /matters/:id` | owner | | 204. The record and its reminders go |

Reminders go out 7 days and 1 day before the deadline. A reminder that would be late is marked `missed` and not sent. The email gives the date and never the title.

## Guides (`/guides`)

| Route | Who | Takes | Returns |
|---|---|---|---|
| `GET /guides` | anyone | `?search=` `?domain=` | Published guides as cards: `id`, `domain`, `title`, `source_law`, `summary`, `has_service`, `verified_at`, `verified_by_name` |
| `GET /guides/:id` | anyone | | The whole guide, with its `summary`. 404 for anything not published |
| `GET /guides/all` | admin | | Every guide in every state with its full text. It is the only read that returns a draft |
| `POST /guides` | admin | `domain`, `title`, `situation`, `law_says`, `your_rights`, `steps`, `get_help`, `source_law`, `source_url`, `summary` (optional, at most 280 characters, empty means none) | 201 the guide as a draft. Editing the `summary` sends a published guide back to draft like any other edit |
| `PUT /guides/:id` | admin | The same fields | The guide as a draft with the stamp cleared. This is the integrity rule |
| `POST /guides/:id/publish` | admin | | The guide, published and stamped. 400 if it does not exist or is already published |
| `POST /guides/:id/withdraw` | admin | `comment` (required) | The guide, `withdrawn`. 400 unless it was `published` |

`domain` is one of `tenancy`, `employment`, `business`, `immigration`, `harassment`, `vehicles`. The same six values are the `area` of a route. The code list is in `server/src/services/domains.js` and a test checks it against both database rules. `summary` is at most 280 characters of text. `source_url` must start with `https://`. The rules are checked before anything is written, so a mistake cannot take a published guide off the site and save nothing.

## Saved guides

| Route | Who | Returns |
|---|---|---|
| `GET /bookmarks` | student or staff | The saved guides that are published, newest save first |
| `POST /guides/:id/bookmark` | student or staff | 201. Saving twice is not an error. 404 for a guide that is not published |
| `DELETE /guides/:id/bookmark` | student or staff | 204. 404 if it was not saved |

## Questions (`/questions`)

| Route | Who | Takes | Returns |
|---|---|---|---|
| `POST /questions` | student or staff | `text` (5000 characters or fewer) | 201 `{ id, text, status, created_at }` |
| `POST /questions/anonymous` | anyone | `text` | 201 the question plus `anon_token` and a `warning`. No account is stored. A login is ignored |
| `GET /questions/mine` | student or staff | | The person's questions with `answer` |
| `GET /questions/anon/:token` | anyone | | `{ id, text, answer, status, created_at }`. 404 for an unknown or badly formed code |
| `GET /questions/open` | expert | | The open questions, oldest first, as `{ id, text, created_at, kind }`. `kind` is `anonymous` or `signed-in` and nothing more |
| `POST /questions/:id/answer` | expert | `answer` (10000 characters or fewer) | `{ id, status }`. 404 if it is not found or already answered |

## Admin (`/admin`)

Every admin route needs an admin login.

| Route | Takes | Returns |
|---|---|---|
| `POST /admin/invites` | `email`, `expires_days` (1 to 30, default 7) | 201 the invitation and a `message`. The code is only in the email. 502 if the email cannot be sent and then no invitation is kept |
| `GET /admin/invites` | | The invitations with `status` (`pending`, `used` or `expired`) and `invited_by`. The code is never listed |
| `GET /admin/users` | | `{ id, name, email, role, email_verified_at, deactivated_at, created_at }` for everyone. There is no password hash and no count of what a person did |
| `PUT /admin/users/:id/role` | `role` (`student`, `staff` or `admin`) | The user. A legal expert cannot be given as a role. An expert's role cannot be changed. The last active admin cannot be demoted |
| `POST /admin/users/:id/deactivate` | | The user. An admin cannot switch off their own account. Old sessions stay dead |
| `POST /admin/users/:id/reactivate` | | The user |
| `GET /admin/emergency-contacts` | | The contacts with `id` and `sort_order` |
| `POST /admin/emergency-contacts` | `name`, `contact`, `when_to_use`, `sort_order` | 201 the contact |
| `PUT /admin/emergency-contacts/:id` | The same fields | The contact |
| `DELETE /admin/emergency-contacts/:id` | | 204. Deleting the last one is safe because the public route falls back to the built-in list |
| `GET /admin/stats` | | Counts only: guides, entries and routes by state, stale entries, bookings, questions, matters, reminders and people by role |

## How many routes

The API has 86 operations. The Swagger page lists all of them and a test checks that list against the real routes. The tables on this page give the detail for each group.

## Email address change (`/auth`)

| Route | Who | What it does |
|---|---|---|
| `POST /auth/change-email` | Signed in | Takes `email` and `current_password`. Nothing changes yet. The new address waits as a pending address and a link is sent to it. A wrong password answers 400 so the website does not sign the person out. The reply is the same whether or not the address is taken. Students and staff must use an ALU address |
| `POST /auth/confirm-email-change` | Anyone with the link | Takes `token`. Switches the address, counts it as confirmed, ends every older session and returns a new session |

## Document checklists (`/checklists`)

A checklist lists the documents a task needs, for example buying a second-hand car. It follows the same steps as a guide: an admin writes it, publishes it, and any edit sends it back to draft.

| Route | Who | What it does |
|---|---|---|
| `GET /checklists` | Anyone | Lists the published checklists |
| `GET /checklists/:id` | Anyone | Reads one published checklist |
| `GET /checklists/all` | Admin | Lists every checklist in every state |
| `POST /checklists` | Admin | Writes a checklist as a draft |
| `PUT /checklists/:id` | Admin | Changes a checklist. It returns to draft |
| `POST /checklists/:id/publish` | Admin | Publishes a checklist |
| `POST /matters/:id/checklist` | Owner | Follows a published checklist |
| `DELETE /matters/:id/checklist` | Owner | Stops following it. The documents stay |

## Matter documents (`/matters/:matterId/documents`)

Files are stored encrypted. Only the owner and the legal expert the matter is shared with at that moment can reach them. Everyone else gets 404.

| Route | Who | What it does |
|---|---|---|
| `GET .../documents` | Owner or the expert it is shared with | Lists the documents |
| `GET .../documents/checklist` | Owner or the expert | Shows each item of the followed checklist with its file |
| `POST .../documents` | Owner | Attaches a PDF, PNG or JPEG sent as raw bytes. At most 25 on a matter and 100 per person |
| `GET .../documents/:docId/file` | Owner or the expert | Downloads the file |
| `DELETE .../documents/:docId` | Owner | Deletes the file and its comments |
| `PUT .../documents/:docId/review` | The expert it is shared with | Records Complete, Needs fixing or Out of date. A note is required unless Complete |
| `POST .../documents/:docId/comments` | The expert it is shared with | Adds a comment, separate from the verdict. At most 50 for a document |

## The complete list

The live Swagger page lists every route with its request and reply: https://alu-legal-companion.onrender.com/api/docs. The same description is in `server/src/openapi.js`. A test compares that file with the real Express routes in both directions, so it cannot drift from the code.

## Postman collection

`server/ALU_Legal_Companion.postman_collection.json` calls every route and checks each reply. Run it on a development database only. It creates records named "Postman" and signs in with the demo passwords.

```bash
cd server
npx newman run ALU_Legal_Companion.postman_collection.json -e ALU_Legal_Companion.local.postman_environment.json
```

- One run uses about half of the 100 sign-in requests one address may make in 15 minutes. Restart the server or wait between two runs, or the server answers 429.
- Email links and invitation codes only appear in an inbox or the server log. So the collection checks the refusals for those routes and not the success path.

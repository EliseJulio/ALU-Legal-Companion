# Test plan

The repository holds the key tests. Further tests are kept outside the repository and are not listed here.

This page lists every automated test in the repository. For each test it gives the layer, the file and what the test checks. The numbers were measured on 19 November 2026.

## At a glance

| Suite | Tool | Files | Tests | Result |
|---|---|---|---|---|
| Server | Jest and Supertest, against a real PostgreSQL | 9 | 113 | all 113 passed |
| Client | Vitest and Testing Library | 14 | 76 | all 76 passed |
| Browser | Playwright, in Chromium | 5 | 13 | all 13 passed |
| Worker | Vitest | 3 | 97 | all 97 passed |

That is 299 tests in 31 files. No test in the set is skipped. These numbers count only the key set in the repository. Running the same commands on the author's computer also runs the further tests, so it reports more.

The booking features were also walked through once with a real server, a real database and a real browser, with no stubbed replies, on a throwaway database. That walk found and fixed a defect in the lawyer's hours card.

## How the tests are run

```bash
cd server && npm test        # needs the alu_legal_test database
cd client && npm test        # no server needed
cd client && npm run e2e     # no server needed, Chromium only
cd signaling && npm test     # no network needed
```

- **Server tests** are in `server/tests`. Each run makes its own private schema inside the test database, applies the migrations and drops the schema at the end. The database is real, so a database rule such as a check constraint is tested as it is.
- **Client tests** are in `client/tests`. Each test replaces the network with a fixed reply. A call the test did not plan for fails.
- **Browser tests** are in `client/tests/e2e`. Every call to `/api` is replaced by a fixed reply from `support.js`. All names, addresses and codes in that data are made up. Chromium is the only browser in the default run.
- **Worker tests** are in `signaling/test`. The room's storage is a stand-in that lives as long as the test.
- **No real network and no real keys.** The Ask AI model is never called by these tests: its page is tested with fixed replies. The mail and the call room are replaced by stand-ins that the tests control. Email is read from the test output.
- **Continuous integration** runs four jobs (server, client, browser, Worker) on every push. A separate scheduled GitHub job calls the job endpoint every ten minutes.

## What the tests protect

| Promise | Where it is tested |
|---|---|
| Only the right role can open a page or call an endpoint | Area 1 |
| A matter is sent to the correct first body | Area 2 |
| Drafts are never public and a checked fact that changes sends a record back to draft | Areas 4 and 10 |
| A deadline is worked out on the server and a reminder is set seven days and one day before | Area 4 |
| A lawyer sees only what the owner shares | Area 4 |
| Anonymous means anonymous and the code is shown once | Areas 5 and 6 |
| A call ticket cannot be forged, is refused for another room and expires | Areas 6 and 13 |
| Lawyers' hours and open slots are read and booked in Kigali time | Area 11 |
| Anonymous data older than 90 days is removed | Area 12 |
| Ask AI fails safely | Area 7 |
| A person can erase their account and their data | Area 8 |
| The main pages work by keyboard and the targets are large enough | Area 9 |

## The tests by area

### 1. Sign up, sign in, sign out and role checks

| Layer | File | What it checks |
|---|---|---|
| Server | `integration/sign-in-and-roles.test.js` | Makes an unverified account, keeps no plain password and returns no token. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses an address outside the ALU domains. |
| Server | `integration/sign-in-and-roles.test.js` | Will not let anyone sign up as a legal expert or an admin. |
| Server | `integration/sign-in-and-roles.test.js` | Verifies the address from the emailed link without signing the person in. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses an emailed link that was already used. |
| Server | `integration/sign-in-and-roles.test.js` | Keeps an unverified account out until the link is used. |
| Server | `integration/sign-in-and-roles.test.js` | Answers the same for a wrong password and an unknown address. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses a switched-off account even with the right password. |
| Server | `integration/sign-in-and-roles.test.js` | Never returns the password hash. |
| Server | `integration/sign-in-and-roles.test.js` | Signing out ends the token and every other token the account holds. |
| Server | `integration/sign-in-and-roles.test.js` | Stops someone guessing the current password from a stolen sign-in. |
| Server | `integration/sign-in-and-roles.test.js` | Asks for a login when there is no token. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses a token signed with a different secret. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses an expired token. |
| Server | `integration/sign-in-and-roles.test.js` | Keeps a student out of the admin pages. |
| Server | `integration/sign-in-and-roles.test.js` | Keeps a staff out of the admin pages. |
| Server | `integration/sign-in-and-roles.test.js` | Keeps a legal_expert out of the admin pages. |
| Server | `integration/sign-in-and-roles.test.js` | Lets an admin in. |
| Server | `integration/sign-in-and-roles.test.js` | Reads the role from the account and not from the token. |
| Server | `integration/sign-in-and-roles.test.js` | Still checks the password against a hash when there is no account. |
| Server | `integration/sign-in-and-roles.test.js` | Answers email_taken and not 500 when two sign-ups for one address arrive together. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses a very long address with 400. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses an address with a space with 400. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses an address with a comma with 400. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses an address with a control character with 400. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses a NUL character anywhere in a JSON body with 400. |
| Server | `integration/sign-in-and-roles.test.js` | Answers a request with an unsupported encoding with 415 and not 500. |
| Server | `integration/sign-in-and-roles.test.js` | Lets a person reset a password after others asked for a link on the same address. |
| Server | `integration/sign-in-and-roles.test.js` | Counts change-email per account, so naming an address never blocks anybody else. |
| Server | `integration/sign-in-and-roles.test.js` | Stops sign-ups that name one address after five tries. |
| Server | `integration/sign-in-and-roles.test.js` | Answers 400 for a day that matches the pattern but is not a date. |
| Server | `integration/sign-in-and-roles.test.js` | Keeps the older invitation working when the new email cannot be sent. |
| Server | `integration/sign-in-and-roles.test.js` | Does not use the invitation up when the account cannot be made. |
| Client | `lib/api.test.js` | Sends the login token once there is one. |
| Client | `lib/api.test.js` | Leaves the login out of an anonymous request. |
| Client | `lib/api.test.js` | Tells the open pages about a write that answers with no body. |
| Client | `lib/api.test.js` | Shows the server’s own words when it refuses a request. |
| Client | `lib/api.test.js` | Carries the machine-readable code the server sends with a refusal. |
| Client | `lib/api.test.js` | Has no code when the server sends none. |
| Client | `lib/api.test.js` | Reads how long to wait from a 429. |
| Client | `lib/api.test.js` | Drops the token on a 401 and tells the page once. |
| Client | `lib/api.test.js` | Does not drop a newer login when an older request is refused. |
| Client | `lib/api.test.js` | Keeps the login when an anonymous request is refused with a 401. |
| Client | `lib/api.test.js` | Keeps the token on a 403, because only the role is wrong. |
| Client | `lib/auth.test.js` | Checks the role and treats nobody as having no role. |
| Client | `lib/auth.test.js` | Lets only students and staff own matters and questions. |
| Client | `lib/auth.test.js` | Keeps the token and only the four public fields of the user. |
| Client | `lib/auth.test.js` | Refuses a session with no token. |
| Client | `lib/auth.test.js` | Removes the stored user as well as the token when the server ends the session. |
| Browser | `e2e/journey-accounts.spec.js` | Sign up is limited to the ALU community and asks the student to check their email. |
| Browser | `e2e/journey-accounts.spec.js` | A wrong password shows the server message and keeps nothing secret in the box. |
| Browser | `e2e/journey-accounts.spec.js` | Signing in shows the name and signing out ends the session. |
| Browser | `e2e/journey-accounts.spec.js` | A student who types an admin address is told they have no permission. |

### 2. The directory: a matter type goes to the right first body

| Layer | File | What it checks |
|---|---|---|
| Browser | `e2e/journey-directory-and-matters.spec.js` | A visitor answers two questions and is told which office a deposit problem goes to first. |

### 3. Guides: published guides are readable and drafts are hidden

| Layer | File | What it checks |
|---|---|---|
| Browser | `e2e/journey-guides.spec.js` | A visitor finds a published guide, reads it and sees that it is information and not advice. |

### 4. Matters, deadlines and reminders

| Layer | File | What it checks |
|---|---|---|
| Server | `integration/matters-and-reminders.test.js` | Lets a student open a matter from a route and takes its first step. |
| Server | `integration/matters-and-reminders.test.js` | Works out the due date on the server from the checked number of days. |
| Server | `integration/matters-and-reminders.test.js` | Sets reminders seven days and one day before the due date. |
| Server | `integration/matters-and-reminders.test.js` | Refuses a due date that is not a real date. |
| Server | `integration/matters-and-reminders.test.js` | Refuses a start date in the future. |
| Server | `integration/matters-and-reminders.test.js` | Is for a signed-in student or staff member only. |
| Server | `integration/matters-and-reminders.test.js` | Shows a person only their own matters. |
| Server | `integration/matters-and-reminders.test.js` | Answers 404 when someone asks for another person’s matter. |
| Server | `integration/matters-and-reminders.test.js` | Lets the lawyer read it without learning who the owner is. |
| Server | `integration/matters-and-reminders.test.js` | Ends the lawyer’s access on the very next request when the owner stops sharing. |
| Server | `integration/matters-and-reminders.test.js` | Keeps it from every lawyer it was not shared with. |
| Server | `integration/matters-and-reminders.test.js` | Lets only the owner share it. |
| Server | `integration/matters-and-reminders.test.js` | Refuses an office that has no lawyer account behind it. |
| Server | `integration/matters-and-reminders.test.js` | Ends the share when an admin links the office to a different account. |
| Server | `integration/matters-and-reminders.test.js` | Ends the share when an admin changes a checked fact and the office goes back to draft. |
| Server | `integration/matters-and-reminders.test.js` | Keeps the share when the admin changes something that is not a checked fact. |
| Server | `integration/matters-and-reminders.test.js` | Gives the lawyer nothing while the office is not published, even if a share is still recorded. |
| Server | `integration/matters-and-reminders.test.js` | Counts the day in Kigali, two hours ahead of UTC. |
| Server | `integration/matters-and-reminders.test.js` | Adds days across a month, a year and a leap day. |
| Browser | `e2e/journey-directory-and-matters.spec.js` | A student goes from the answer to tracking the matter. |

### 5. Anonymous questions

| Layer | File | What it checks |
|---|---|---|
| Server | `integration/anonymous-questions.test.js` | Stores no account and gives back a code once, with a warning. |
| Server | `integration/anonymous-questions.test.js` | Keeps only a hash of the code, so the database cannot give it back. |
| Server | `integration/anonymous-questions.test.js` | Stays anonymous even when the person is signed in. |
| Server | `integration/anonymous-questions.test.js` | Refuses an empty question and one that is too long. |
| Server | `integration/anonymous-questions.test.js` | Finds the question with the code in the body, whatever the letter case or the dashes. |
| Server | `integration/anonymous-questions.test.js` | No longer answers a read with the code in the address. |
| Server | `integration/anonymous-questions.test.js` | Answers 404 for a code that was never given. |
| Server | `integration/anonymous-questions.test.js` | Answers 404 for a missing or badly formed code, without reading the address. |
| Client | `components/TokenDisplay.test.jsx` | Shows the code and says it cannot be recovered. |
| Client | `components/TokenDisplay.test.jsx` | Keeps Continue off until the person says the code is saved. |
| Client | `components/TokenDisplay.test.jsx` | Tells the person what to do when copying is blocked. |
| Client | `lib/questions.test.js` | Posts the code in the body to the status route, with no login and nothing in the address. |
| Browser | `e2e/journey-questions-and-booking.spec.js` | A visitor asks anonymously and reads the answer with the code. |

### 6. Bookings and calls

| Layer | File | What it checks |
|---|---|---|
| Client | `components/CallRoom.test.jsx` | Tells a refused guest they can ask to join again and offers the button. |
| Client | `components/CallRoom.test.jsx` | Says the room is full when the service cannot take another connection. |
| Client | `components/CallRoom.test.jsx` | Says the lawyer lost their connection while the guest keeps the call. |
| Client | `components/CallRoom.test.jsx` | Tells the guest to wait and shows no call controls yet. |
| Client | `components/CallRoom.test.jsx` | Lets the lawyer admit or turn away someone at the door. |
| Client | `components/CallRoom.test.jsx` | Never shows the admit buttons to the guest. |
| Client | `components/CallRoom.test.jsx` | Has microphone, camera, full screen and leave controls and passes the presses on. |
| Client | `components/CallRoom.test.jsx` | Offers Flip camera only when the device has a second camera. |
| Client | `components/CallRoom.test.jsx` | Hides Flip camera when there is one camera. |
| Client | `components/CallRoom.test.jsx` | Says so when the other person turns their camera off. |
| Client | `components/CallRoom.test.jsx` | Calls the lawyer’s button End call for everyone. |
| Client | `components/CallRoom.test.jsx` | Lets the guest leave, which closes their side and goes back. |
| Client | `components/CallRoom.test.jsx` | Says the lawyer ended the call and offers to join again. |
| Client | `components/CallRoom.test.jsx` | Offers no way to rejoin straight after a deliberate leave. |
| Client | `lib/callState.test.js` | Waits in the lobby until someone knocks, then shows the knock. |
| Client | `lib/callState.test.js` | Starts the call only after the lawyer admits. |
| Client | `lib/callState.test.js` | Goes back to the lobby and says so, when the guest leaves. |
| Client | `lib/callState.test.js` | Waits to be admitted and does not start the call on its own. |
| Client | `lib/callState.test.js` | Starts when admitted and is told plainly when refused. |
| Client | `lib/callState.test.js` | Ends with a clear reason when the lawyer ends it for everyone and keeps that reason. |
| Client | `lib/callState.test.js` | Keeps the call going when only the link to the room drops. |
| Client | `lib/callState.test.js` | Shows the other person’s microphone and camera state. |
| Client | `lib/callState.test.js` | Fails when the ticket is refused, but not on a harmless message error. |
| Browser | `e2e/journey-questions-and-booking.spec.js` | A visitor books anonymously, saves the code and checks the booking and gets the join link. |

### 7. Ask AI

| Layer | File | What it checks |
|---|---|---|
| Client | `pages/AskAI.test.jsx` | Points the Ask button at its hint. |
| Client | `pages/AskAI.test.jsx` | Reads the question from the router state. |
| Client | `pages/AskAI.test.jsx` | Drops ?q= from the address once it is read. |
| Client | `pages/AskAI.test.jsx` | Sends nothing until the person ticks I understand. |
| Client | `pages/AskAI.test.jsx` | Lists the source guides and opens each one in a new tab, so the answer stays on the page. |
| Client | `pages/AskAI.test.jsx` | Says plainly that it is not available when the model is not set up. |
| Client | `pages/AskAI.test.jsx` | Shows a clear message and no answer when the model fails. |

### 8. Account erasure

| Layer | File | What it checks |
|---|---|---|
| Server | `integration/erase-account.test.js` | Needs a login. |
| Server | `integration/erase-account.test.js` | Refuses a wrong password and deletes nothing. |
| Server | `integration/erase-account.test.js` | Keeps the account of a legal expert, who is not erased this way. |
| Server | `integration/erase-account.test.js` | Removes the person, their matters, files and questions and leaves other people alone. |
| Server | `integration/erase-account.test.js` | Ends the old sign-in. |
| Server | `integration/erase-account.test.js` | Cancels an open booking and keeps every booking with no name, no account and no topic. |
| Server | `integration/erase-account.test.js` | Tells the lawyer once about an accepted consultation that is erased and not about a requested one. |
| Server | `integration/erase-account.test.js` | Does not count an erased booking as an anonymous one. |
| Server | `integration/erase-account.test.js` | Refuses with 409 and changes nothing when the account is linked to records it published. |
| Server | `integration/erase-account.test.js` | Stops one account after 10 wrong passwords. |
| Client | `pages/AccountDelete.test.jsx` | Sends nothing until the password is typed and the box is ticked. |
| Client | `pages/AccountDelete.test.jsx` | Sends the password and the confirmation, clears the session and goes to the front page. |
| Client | `pages/AccountDelete.test.jsx` | Shows the server message on a wrong password and stays signed in. |
| Client | `pages/AccountDelete.test.jsx` | Gives a legal expert no delete button and tells them to ask an admin. |

### 9. Accessibility basics in the browser

| Layer | File | What it checks |
|---|---|---|
| Browser | `e2e/journey-accessibility.spec.js` | The main menu is reached by keyboard in order, with the emergency numbers before the search. |
| Browser | `e2e/journey-accessibility.spec.js` | The control you have reached by keyboard shows a visible focus ring. |
| Browser | `e2e/journey-accessibility.spec.js` | Every footer link is at least 44 px high at 1440 px. |
| Browser | `e2e/journey-accessibility.spec.js` | Every footer link is at least 44 px high at 390 px. |

### 10. Publishing rules: drafts, checked facts and races

| Layer | File | What it checks |
|---|---|---|
| Server | `integration/integrity-rules.test.js` | Rejects a published guide with no verifier and accepts one with a verifier. |
| Server | `integration/integrity-rules.test.js` | Rejects a published directory entry with no verifier. |
| Server | `integration/integrity-rules.test.js` | Rejects a published matter route with no verifier. |
| Server | `integration/integrity-rules.test.js` | Rejects a published document checklist with no verifier. |
| Server | `integration/integrity-rules.test.js` | Stores a 64-character hash for every anonymous question and booking made through the API. |
| Server | `integration/integrity-rules.test.js` | Hashes an old plain-text code the way the application does and leaves a hash alone. |
| Server | `integration/integrity-rules.test.js` | Restores a missing published rule and refuses to add it over an unverified published row. |
| Server | `integration/publish-race.test.js` | Answers 409 and leaves the record a draft. |
| Server | `integration/publish-race.test.js` | Answers 409 and leaves the record a draft. |
| Server | `integration/publish-race.test.js` | Answers 409 and leaves the record a draft. |
| Server | `integration/publish-race.test.js` | Answers 409 and leaves the record a draft. |

### 11. Lawyers' hours, open slots, rescheduling and cancelling

| Layer | File | What it checks |
|---|---|---|
| Server | `integration/booking-changes.test.js` | Lets the linked lawyer suggest only an open time for a waiting request and mails the owner the time without the topic. |
| Server | `integration/booking-changes.test.js` | Moves the booking to the suggested time when the person accepts, makes its reminders and sends both accepted notices. |
| Server | `integration/booking-changes.test.js` | Refuses an accept with 400 when another booking has taken the suggested time and keeps the suggestion. |
| Server | `integration/booking-changes.test.js` | Clears a suggestion that the person declines, leaves the request waiting and tells the lawyer the time only. |
| Server | `integration/booking-changes.test.js` | Lets an anonymous person accept or decline by the code in the body, mails no one who is named and answers an unknown code with 404. |
| Server | `integration/booking-changes.test.js` | Moves an accepted consultation to a new time that waits for the lawyer, frees the old slot, cancels its reminders and mails the lawyer the new time. |
| Server | `integration/booking-changes.test.js` | Refuses a reschedule to a time that is not open, to the time already booked, after the start and for someone else’s booking. |
| Server | `integration/booking-changes.test.js` | Shows the suggested time on the three reads and the migration adds its columns and its check. |
| Server | `integration/booking-changes.test.js` | Re-arms the reminders when a moved consultation is accepted again at another time. |
| Server | `integration/booking-changes.test.js` | Leaves a day reminder already sent for the same time alone, so it is not sent twice. |
| Server | `integration/booking-changes.test.js` | Re-arms a day reminder that was already sent for the old time. |
| Server | `integration/booking-changes.test.js` | Lets no more than three open requests exist when two accepted consultations are moved back at once. |
| Server | `integration/booking-changes.test.js` | Refuses an accept when the suggested time changed after it was read and changes nothing. |
| Server | `integration/booking-changes.test.js` | Drops the stored video room when the time changes, by a move or by an accepted suggestion. |
| Server | `integration/booking-changes.test.js` | Still answers and mails the lawyer when cancelling the reminders fails. |
| Server | `integration/booking-changes.test.js` | Does not leave a waiting reminder for the old time when the new time is too near for it. |
| Server | `integration/booking-changes.test.js` | Handles an accepted booking whose account was erased in every route, with no error and no mail. |
| Client | `components/CancelConsultation.test.jsx` | Asks inline at touch-target size, never opens a browser dialog and Keep it cancels nothing. |
| Client | `components/CancelConsultation.test.jsx` | Moves focus to Keep it when the question opens and back to the cancel button when Keep it is pressed. |
| Client | `components/CancelConsultation.test.jsx` | Cancels once on confirm, then tells the page to refresh. |
| Client | `components/CancelConsultation.test.jsx` | Shows the server message when the cancel is refused and keeps the booking on the page. |
| Client | `components/ChangeTime.test.jsx` | Loads the open times of the provider, shows them in Kigali time and sends the one picked. |
| Client | `components/ChangeTime.test.jsx` | After a 409 refusal, loads the open times again and clears the chosen time. |
| Client | `components/ChangeTime.test.jsx` | Takes focus when it opens. |
| Client | `components/ChangeTime.test.jsx` | Says so when the provider has no open time in the next two weeks. |
| Client | `components/ConsultationHours.test.jsx` | Has a heading, says in plain words what the hours are for, labels each time and sizes its buttons to touch. |
| Client | `components/ConsultationHours.test.jsx` | Shows the standard hours and saves them whole when the answer comes after the first draw. |
| Client | `components/ConsultationHours.test.jsx` | Says they are standard, shows Monday to Friday nine to five and keeps them as the lawyer’s own when saved unchanged. |
| Client | `components/ConsultationHours.test.jsx` | Says nobody can book until hours are added and saves an empty list as a deliberate closure. |
| Client | `components/ConsultationHours.test.jsx` | Adds nine-to-twelve on the day asked, removes only the window asked and saves the whole set in day order. |
| Client | `components/ConsultationHours.test.jsx` | Refuses an overlap without sending anything and keeps the rows when the server refuses a save. |
| Client | `lib/cancelBooking.test.js` | Allows only a request or an accepted time still to come and nothing already over, declined or unreadable. |
| Client | `lib/cancelBooking.test.js` | Posts to the booking with the login. |
| Client | `lib/cancelBooking.test.js` | Sends the code in the body only, with no login and nothing in the address. |
| Client | `lib/dates.test.js` | Gives the Kigali calendar day near midnight, which is the next day in UTC. |
| Client | `lib/dates.test.js` | Gives the Kigali day at the midnight edge. |
| Client | `lib/slots.test.js` | Asks Intl for the Africa/Kigali zone by name and reads 07:00 UTC as 09:00 while the process is on another zone. |
| Client | `lib/slots.test.js` | Keeps only days with a time to book, in date order, with a weekday label, a count and each time’s Kigali clock. |
| Client | `lib/slots.test.js` | Gives no clock for an unreadable time, no days for an empty or missing payload and says the zone in words. |

### 12. Scheduled jobs and retention

| Layer | File | What it checks |
|---|---|---|
| Server | `integration/internal-jobs.test.js` | Answers 401 when the secret header is missing. |
| Server | `integration/internal-jobs.test.js` | Answers 401 for a wrong secret of the same length. |
| Server | `integration/internal-jobs.test.js` | Answers 401 for a wrong secret of a different length. |
| Server | `integration/internal-jobs.test.js` | Answers 404, like an unknown path, when JOB_SECRET is shorter than 32 characters. |
| Server | `integration/internal-jobs.test.js` | Answers 404 when JOB_SECRET is empty or missing. |
| Server | `integration/internal-jobs.test.js` | Runs the reminders and the retention purge with the right secret and returns counts only. |
| Server | `integration/internal-jobs.test.js` | Does not stop the other jobs and the route still answers 200 with counts and an errors count. |
| Server | `integration/internal-jobs.test.js` | Do not spend the budget, so a flood of them cannot stop the real job. |
| Server | `integration/internal-jobs.test.js` | Sends a due consultation reminder as well as a deadline reminder. |
| Server | `integration/retention.test.js` | Deletes an anonymous question answered more than 90 days ago and keeps a recent one. |
| Server | `integration/retention.test.js` | Keeps an anonymous question with no answer, however old and one answered exactly 90 days ago. |
| Server | `integration/retention.test.js` | Deletes an old answered question that has no time of answer, by its creation date. |
| Server | `integration/retention.test.js` | Deletes anonymous bookings more than 90 days past whatever their status and keeps the rest. |
| Server | `integration/retention.test.js` | Never deletes a signed-in question or booking, however old. |
| Server | `integration/retention.test.js` | Deletes tokens expired or used more than 30 days ago and keeps the rest. |

### 13. The call room (Cloudflare Worker)

| Layer | File | What it checks |
|---|---|---|
| Worker | `test/index.test.js` | Answers /health with the JSON status and nothing else. |
| Worker | `test/index.test.js` | Answers 405 with an Allow header and an empty body to a POST to /health. |
| Worker | `test/index.test.js` | Returns 404 for other paths. |
| Worker | `test/index.test.js` | Returns 426 for a non-upgrade request to a room. |
| Worker | `test/index.test.js` | Refuses a missing Origin with 403 before the subprotocol check. |
| Worker | `test/index.test.js` | Refuses an unlisted Origin with 403 before the subprotocol check. |
| Worker | `test/index.test.js` | Sets no cookies. |
| Worker | `test/index.test.js` | Answers 401 with no subprotocol and never touches the namespace. |
| Worker | `test/index.test.js` | Answers 401 when the first entry is wrong. |
| Worker | `test/index.test.js` | Answers 401 when there are not exactly two entries. |
| Worker | `test/index.test.js` | Answers 401 for a ticket made for another room. |
| Worker | `test/index.test.js` | Answers 401 for an expired ticket. |
| Worker | `test/index.test.js` | Answers 401 for a ticket signed with another secret. |
| Worker | `test/index.test.js` | Upgrades with 101 and selects alu-call.v1 for a good ticket. |
| Worker | `test/index.test.js` | Trims stray spaces from the secret before checking a ticket. |
| Worker | `test/index.test.js` | Answers 503 with no detail when the secret is missing or short after trimming. |
| Worker | `test/index.test.js` | Runs hello, knock, admit and signal through the Durable Object. |
| Worker | `test/index.test.js` | Still checks the hello ticket inside the Durable Object. |
| Worker | `test/index.test.js` | Keeps rooms apart. |
| Worker | `test/room.test.js` | Answers a good hello with ready. |
| Worker | `test/room.test.js` | Rejects a bad ticket with bad_ticket and closes 4001. |
| Worker | `test/room.test.js` | Rejects a ticket made for another room. |
| Worker | `test/room.test.js` | Closes 4001 when no hello arrives within 5 seconds. |
| Worker | `test/room.test.js` | Does not close an authenticated socket at 5 seconds. |
| Worker | `test/room.test.js` | Refuses other messages before hello. |
| Worker | `test/room.test.js` | Refuses a second hello. |
| Worker | `test/room.test.js` | Tells a joiner whether the peer is present. |
| Worker | `test/room.test.js` | Replaces an older connection of the same role with 4002. |
| Worker | `test/room.test.js` | Does not tell the guest the peer left when a host is replaced. |
| Worker | `test/room.test.js` | Knocks the host when a guest joins. |
| Worker | `test/room.test.js` | Knocks when the host connects after a guest is waiting. |
| Worker | `test/room.test.js` | Admit sends admitted to the guest and start to the host. |
| Worker | `test/room.test.js` | Deny sends denied then closes the guest with 4003. |
| Worker | `test/room.test.js` | A guest cannot admit or deny. |
| Worker | `test/room.test.js` | Refuses guest signal until admitted. |
| Worker | `test/room.test.js` | Refuses host signal until a guest is admitted. |
| Worker | `test/room.test.js` | Relays signals both ways after admission. |
| Worker | `test/room.test.js` | Rejects signal data that is not an object. |
| Worker | `test/room.test.js` | Keeps an admitted guest admitted when a dropped link comes back within the grace. |
| Worker | `test/room.test.js` | Does not keep admission for a guest who was never admitted. |
| Worker | `test/room.test.js` | Is admitted at once when it says hello again 4 minutes 59.999 seconds after a drop. |
| Worker | `test/room.test.js` | Knocks the host and does not admit a guest who says hello 5 minutes after a drop. |
| Worker | `test/room.test.js` | Knocks a guest who said bye and comes back within a minute. |
| Worker | `test/room.test.js` | Starts the 5 minutes again for each new drop. |
| Worker | `test/room.test.js` | Keeps admission for a takeover made long after a drop that was already settled. |
| Worker | `test/room.test.js` | Keeps admission for a takeover, however long the old socket was open. |
| Worker | `test/room.test.js` | Does not start the grace when a replaced socket closes after the takeover. |
| Worker | `test/room.test.js` | Tells the other side when a socket closes. |
| Worker | `test/room.test.js` | Bye tells the other side and closes the sender. |
| Worker | `test/room.test.js` | A guest who says bye must be let in again. |
| Worker | `test/room.test.js` | A host who says bye ends the admission. |
| Worker | `test/room.test.js` | A replaced socket that says bye does not end the new admission. |
| Worker | `test/room.test.js` | Answers ping with pong. |
| Worker | `test/room.test.js` | Answers invalid JSON and unknown types with bad_message. |
| Worker | `test/room.test.js` | Closes a seventh socket at once with 4007, counting sockets that have not said hello. |
| Worker | `test/room.test.js` | Closes 4004 for a message over 16 KB. |
| Worker | `test/room.test.js` | Accepts a message of exactly 16 KB. |
| Worker | `test/room.test.js` | Counts bytes, not characters. |
| Worker | `test/room.test.js` | Allows 200 messages in 10 seconds and stops the 201st with 4005. |
| Worker | `test/room.test.js` | Lets the count recover after the window passes. |
| Worker | `test/room.test.js` | Sets the alarm to the latest ticket exp. |
| Worker | `test/room.test.js` | Closes every socket with 4006 and clears state when it fires. |
| Worker | `test/room.test.js` | Is false before admission and true for a reconnecting admitted guest. |
| Worker | `test/room.test.js` | Lets a guest knock again after the cool-down. |
| Worker | `test/room.test.js` | Refuses a knock inside 10 seconds of a deny and does not knock the host. |
| Worker | `test/room.test.js` | A guest who was admitted and then denied is no longer admitted. |
| Worker | `test/room.test.js` | Does not keep a denial in storage. |
| Worker | `test/room.test.js` | Refuses a host admit after a deny. |
| Worker | `test/room.test.js` | Does not refuse the host after a deny. |
| Worker | `test/room.test.js` | A second admit sends nothing. |
| Worker | `test/room.test.js` | Tells the host to start with a new gen when a new guest socket takes over. |
| Worker | `test/room.test.js` | A second hello from the same socket changes no gen and sends no start. |
| Worker | `test/room.test.js` | Is not installed as a peer. |
| Worker | `test/room.test.js` | Keeps an admission inside the grace window. |
| Worker | `test/room.test.js` | Never moves the alarm earlier than a later ticket set it. |
| Worker | `test/room.test.js` | Guest takeover gives the guest ready then admitted and the host a new start. |
| Worker | `test/room.test.js` | Host takeover gives the host ready then start and the guest a new admitted. |
| Worker | `test/room.test.js` | Does not fire when the other side is absent. |
| Worker | `test/room.test.js` | Does not fire for a guest who was never admitted. |
| Worker | `test/room.test.js` | Does not fire on a reconnect right after deny. |
| Worker | `test/room.test.js` | First admission still sends admitted and start once. |
| Worker | `test/ticket.test.js` | Accepts a good ticket and returns its claims. |
| Worker | `test/ticket.test.js` | Rejects a bad signature. |
| Worker | `test/ticket.test.js` | Rejects a tampered payload. |
| Worker | `test/ticket.test.js` | Rejects alg none. |
| Worker | `test/ticket.test.js` | Rejects another alg even when signed with the secret. |
| Worker | `test/ticket.test.js` | Rejects an expired ticket. |
| Worker | `test/ticket.test.js` | Rejects wrong claims: room missing. |
| Worker | `test/ticket.test.js` | Rejects wrong claims: room not hex. |
| Worker | `test/ticket.test.js` | Rejects wrong claims: room uppercase. |
| Worker | `test/ticket.test.js` | Rejects wrong claims: room too short. |
| Worker | `test/ticket.test.js` | Rejects wrong claims: role unknown. |
| Worker | `test/ticket.test.js` | Rejects wrong claims: audio a string. |
| Worker | `test/ticket.test.js` | Rejects wrong claims: exp a string. |
| Worker | `test/ticket.test.js` | Rejects wrong claims: iat missing. |
| Worker | `test/ticket.test.js` | Rejects a ticket for a different room than the URL. |
| Worker | `test/ticket.test.js` | Rejects junk. |

## The routing check

This is a measurement, not one of the tests above and `npm test` does not run it.

- The situations are in `docs1/routing-test-set.json`. There are 12, taken from the needs survey. Nine are covered by a published route and three are not covered by any route.
- `npm run evaluate:routing`, run from `server/`, puts each situation through the same search a reader uses. It takes the first body the platform names and compares it with the body recorded for that situation in advance. It reads the database and writes nothing.
- Measured on 19 November 2026 against the demo database:

```
Routing evaluation: Routing accuracy test set (proposal section 3.2.2, Table 8, FR-13)
==================================================================
  situations in the set                      12
  covered by a published route               9
  not covered by any route (coverage gaps)   3

  covered situations sent to the right body  9 of 9
  sent to another body                       0
  nothing matched                            0
  right body among the first three results   9 of 9
  ROUTING ACCURACY on covered situations     100%   (target: at least 90%)

Each covered situation
  # 1 right  "A landlord kept my deposit or part of it"
  # 2 right  "A landlord raised my rent or told me to leave and it seemed unfair"
  # 3 right  "I worked or interned with no written contract"
  # 4 right  "I was paid late, paid less than agreed or not paid at all"
  # 5 right  "I needed to register a business or get a licence or tax number"
  # 6 right  "I had trouble with a visa, residence permit or permission to work in Rwanda"
  # 7 right  "I experienced sexual harassment or harassment because of who I am"
  # 9 right  "I lost money to online fraud or a mobile-money scam"
 #12 right  "Registering a business"

Situations no route covers: what the platform named
  # 8 "I was treated unfairly because of my nationality, gender or disability"
        platform: Isange One Stop Centre
 #10 "I had a problem with the police and did not know my rights"
        platform: Rwanda Investigation Bureau (RIB)
 #11 "I had a family or inheritance matter I needed legal help with"
        platform: Access to Justice Bureau (MAJ) of your district
```

- Of the nine covered situations, 9 of 9 (100%, n = 9) were sent to the right first body. That is a small sample.
- Limits: the needs survey has 5 respondents. The proposal asks for thirty situations and this set has 12. Eleven of the 12 are the survey's own option wording. One is a respondent's free-text answer. No legal expert was available. The expected first bodies were recorded by the researcher from the legal basis each published route cites and no lawyer has checked them. The route keywords were written by the same researcher.
- A check that uses plain paraphrases written by a developer is a different measurement. It is not reported here.

## What these tests do not cover

- **Browser media and real calls.** The browser tests do not open a camera or a microphone and no test makes a real call between two devices. Video, sound and the relay used when a direct connection is blocked are checked by hand.
- **The Worker's "Not now" answer and takeover logic.** The browser tests do not reach them. They are tested only by the Worker's own unit tests.
- **Live email delivery.** Mail is read from the test output, not from an inbox.
- **Phone behaviour.** The browser tests check sizes and keyboard use in Chromium at phone width. They do not run on a real phone.
- **Load.** No test sends many requests at once or measures speed under load.
- **Screen readers.** No test uses a screen reader. Keyboard use and focus are checked, but not what a screen reader says.
- **Admin editing screens in a browser.** The browser tests do not open the admin pages and the client tests listed here do not cover them.
- **The live storage of the Worker.** The Worker tests use a stand-in for the room's storage. How Cloudflare stores the room in production is not tested.
- **The real Redis rate limiter.** The rate limits are not tested against the Redis store used when `REDIS_URL` is set.
- **The live security headers** of the website.
- **Password reset and email change in a browser.** The server side is tested, but no browser test walks through either page from start to finish.
- **Matter files and their checks.** No test in the repository covers uploading, viewing or checking a matter file.
- **Browsers other than Chromium** in the default run.
- **The Ask AI answers themselves.** The tests check that the page behaves correctly around the model, not what the model says.
- **Tests kept outside the repository.** Only the key tests are in the repository and only they are listed here.

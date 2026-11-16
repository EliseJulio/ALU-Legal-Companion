# Test plan

This page lists every automated test in the repository. For each test it gives the area, the file and what the test checks. The numbers were measured on 16 November 2026.

## At a glance

| Suite | Tool | Files | Tests | Result | Time |
|---|---|---|---|---|---|
| Server | Jest and Supertest, against a real PostgreSQL | 10 | 83 | 83 passed | 73 s |
| Client | Vitest and Testing Library | 9 | 55 | 55 passed | 15 s |
| Browser | Playwright, in Chromium, Firefox and WebKit | 5 | 13 in each browser | 13 of 13 in each | 19 s, 37 s and 22 s |
| Signaling Worker | Vitest | 3 | 79 | 79 passed | 3 s |

The client build and the lint check both finish without errors. No test was skipped and none was retried.

## How the tests are run

```bash
cd server && npm test        # needs the alu_legal_test database
cd client && npm test        # no server needed
cd client && npm run e2e     # no server needed
cd signaling && npm test     # no network needed
```

- **Server tests.** Each run makes its own private schema inside the test database, applies the migrations and drops the schema at the end. The database is real, so a database rule such as a check constraint is tested as it is.
- **Client tests.** Each test replaces the network with a fixed reply. A call the test did not plan for fails.
- **Browser tests.** Every call to `/api` is replaced by a fixed reply from `client/tests/e2e/support.js`. All names, addresses and codes in that data are made up.
- **No real network and no real keys.** The AI model is replaced by a small local server that the test controls. Email is printed to the console and read from there. The call room is replaced by a stand-in in the page tests.

## What the tests protect

| Promise | Where it is tested |
|---|---|
| Only the right role can open a page or call an endpoint | Area 1 |
| A matter is sent to the correct first body | Area 2 |
| Drafts are never public | Area 3 |
| A deadline is worked out on the server and a reminder is set seven days and one day before | Area 4 |
| Anonymous means anonymous, and the code is shown once | Areas 5 and 6 |
| A call ticket lasts four hours, names no one and cannot be forged | Area 6 |
| Ask AI fails safely | Area 7 |
| A person can erase their account and their data | Area 8 |
| Errors are short JSON messages with no stack trace | Area 9 |
| The main pages work by keyboard and the targets are large enough | Area 10 |

## The tests by area

### 1. Sign up, sign in, sign out and role checks

| Level | File | What it checks |
|---|---|---|
| Server | `integration/sign-in-and-roles.test.js` | Makes an unverified account, keeps no plain password and returns no token. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses an address outside the ALU domains. |
| Server | `integration/sign-in-and-roles.test.js` | Will not let anyone sign up as a legal expert or an admin. |
| Server | `integration/sign-in-and-roles.test.js` | Verifies the address from the emailed link and then signs the person in. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses an emailed link that was already used. |
| Server | `integration/sign-in-and-roles.test.js` | Keeps an unverified account out until the link is used. |
| Server | `integration/sign-in-and-roles.test.js` | Answers the same for a wrong password and an unknown address. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses a switched-off account even with the right password. |
| Server | `integration/sign-in-and-roles.test.js` | Never returns the password hash. |
| Server | `integration/sign-in-and-roles.test.js` | Signing out ends the token and every other token the account holds. |
| Server | `integration/sign-in-and-roles.test.js` | Asks for a login when there is no token. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses a token signed with a different secret. |
| Server | `integration/sign-in-and-roles.test.js` | Refuses an expired token. |
| Server | `integration/sign-in-and-roles.test.js` | Keeps a student, a staff member and a legal expert out of the admin pages. |
| Server | `integration/sign-in-and-roles.test.js` | Lets an admin in. |
| Server | `integration/sign-in-and-roles.test.js` | Reads the role from the account and not from the token. |
| Client | `lib/auth.test.js` | Checks the role, and treats nobody as having no role. |
| Client | `lib/auth.test.js` | Lets only students and staff own matters and questions. |
| Client | `lib/auth.test.js` | Keeps the token and only the four public fields of the user. |
| Client | `lib/auth.test.js` | Refuses a session with no token. |
| Client | `lib/auth.test.js` | Removes the stored user as well as the token when the server ends the session. |
| Client | `lib/api.test.js` | Sends the login token once there is one. |
| Client | `lib/api.test.js` | Leaves the login out of an anonymous request. |
| Client | `lib/api.test.js` | Shows the server’s own words when it refuses a request. |
| Client | `lib/api.test.js` | Reads how long to wait from a 429. |
| Client | `lib/api.test.js` | Drops the token on a 401 and tells the page once. |
| Client | `lib/api.test.js` | Keeps the token on a 403, because only the role is wrong. |
| Browser | `e2e/journey-accounts.spec.js` | Sign up is limited to the ALU community and asks the student to check their email. |
| Browser | `e2e/journey-accounts.spec.js` | A wrong password shows the server message and keeps nothing secret in the box. |
| Browser | `e2e/journey-accounts.spec.js` | Signing in shows the name and signing out ends the session. |
| Browser | `e2e/journey-accounts.spec.js` | A student who types an admin address is told they have no permission. |

### 2. The directory: a matter type goes to the right first body

| Level | File | What it checks |
|---|---|---|
| Server | `integration/directory-routing.test.js` | Sends a deposit problem to the Abunzi committee. |
| Server | `integration/directory-routing.test.js` | Sends a wages problem to the labour inspector. |
| Server | `integration/directory-routing.test.js` | Puts the route that matches more of the words first. |
| Server | `integration/directory-routing.test.js` | Finds nothing for words that match no route. |
| Server | `integration/directory-routing.test.js` | Treats text that looks like SQL as plain words. |
| Server | `integration/directory-routing.test.js` | Hides a draft route and a route whose first body is not checked yet. |
| Server | `integration/directory-routing.test.js` | Gives the steps, the deadline and the first body for one route, without any account id. |
| Browser | `e2e/journey-directory-and-matters.spec.js` | A visitor answers two questions and is told which office a deposit problem goes to first. |

### 3. Guides: published guides are readable and drafts are hidden

| Level | File | What it checks |
|---|---|---|
| Server | `integration/guides-public.test.js` | Lists published guides only. |
| Server | `integration/guides-public.test.js` | Does not send the full text on the list. |
| Server | `integration/guides-public.test.js` | Opens a published guide with its law and its steps. |
| Server | `integration/guides-public.test.js` | Answers 404 to the public for a draft guide. |
| Server | `integration/guides-public.test.js` | Keeps the list of every guide, drafts included, for the admin only. |
| Server | `integration/guides-public.test.js` | Gives a withdrawn guide a 410 with the reason instead of its text. |
| Browser | `e2e/journey-guides.spec.js` | A visitor finds a published guide, reads it, and sees that it is information and not advice. |

### 4. Matters, deadlines and reminders

| Level | File | What it checks |
|---|---|---|
| Server | `integration/matters-and-reminders.test.js` | Lets a student open a matter from a route and takes its first step. |
| Server | `integration/matters-and-reminders.test.js` | Works out the due date on the server from the checked number of days. |
| Server | `integration/matters-and-reminders.test.js` | Sets reminders seven days and one day before the due date. |
| Server | `integration/matters-and-reminders.test.js` | Refuses a due date that is not a real date. |
| Server | `integration/matters-and-reminders.test.js` | Refuses a start date in the future. |
| Server | `integration/matters-and-reminders.test.js` | Is for a signed-in student or staff member only. |
| Server | `integration/matters-and-reminders.test.js` | Shows a person only their own matters. |
| Server | `integration/matters-and-reminders.test.js` | Answers 404 when someone asks for another person’s matter. |
| Server | `integration/matters-and-reminders.test.js` | Counts the day in Kigali, two hours ahead of UTC. |
| Server | `integration/matters-and-reminders.test.js` | Adds days across a month, a year and a leap day. |
| Browser | `e2e/journey-directory-and-matters.spec.js` | A student goes from the answer to tracking the matter. |

### 5. Anonymous questions

| Level | File | What it checks |
|---|---|---|
| Server | `integration/anonymous-questions.test.js` | Stores no account and gives back a code once, with a warning. |
| Server | `integration/anonymous-questions.test.js` | Keeps only a hash of the code, so the database cannot give it back. |
| Server | `integration/anonymous-questions.test.js` | Stays anonymous even when the person is signed in. |
| Server | `integration/anonymous-questions.test.js` | Refuses an empty question and one that is too long. |
| Server | `integration/anonymous-questions.test.js` | Finds the question with the code, whatever the letter case or the dashes. |
| Server | `integration/anonymous-questions.test.js` | Answers 404 for a code that was never given. |
| Client | `components/TokenDisplay.test.jsx` | Shows the code and says it cannot be recovered. |
| Client | `components/TokenDisplay.test.jsx` | Keeps Continue off until the person says the code is saved. |
| Client | `components/TokenDisplay.test.jsx` | Tells the person what to do when copying is blocked. |
| Browser | `e2e/journey-questions-and-booking.spec.js` | A visitor asks anonymously and reads the answer with the code. |

### 6. Bookings and calls

| Level | File | What it checks |
|---|---|---|
| Server | `integration/bookings-and-calls.test.js` | Lets a student book a lawyer, and returns no account id. |
| Server | `integration/bookings-and-calls.test.js` | Is for a signed-in student or staff member only. |
| Server | `integration/bookings-and-calls.test.js` | Lets a visitor book without a name, with a code that is kept only as a hash. |
| Server | `integration/bookings-and-calls.test.js` | Refuses a time that is in the past. |
| Server | `integration/bookings-and-calls.test.js` | Refuses a lawyer who does not take bookings or has not been checked. |
| Server | `integration/bookings-and-calls.test.js` | Gives the lawyer a host ticket and the student a guest ticket for the same room. |
| Server | `integration/bookings-and-calls.test.js` | Lets an anonymous booker join with the code, and the ticket names no one. |
| Server | `integration/bookings-and-calls.test.js` | Gives no call for a booking that has not been accepted. |
| Server | `integration/bookings-and-calls.test.js` | Answers 404 to a different student. |
| Server | `integration/bookings-and-calls.test.js` | Falls back to the lawyer’s Meet link when calls inside the platform are not set up. |
| Server | `unit/call-ticket-rules.test.js` | Lasts four hours. |
| Server | `unit/call-ticket-rules.test.js` | Holds no name, email or account, only the room, the role and the audio choice. |
| Server | `unit/call-ticket-rules.test.js` | Is signed with the shared secret the signaling Worker checks it with. |
| Server | `unit/call-ticket-rules.test.js` | Is accepted while it is valid. |
| Server | `unit/call-ticket-rules.test.js` | Is refused after it expires. |
| Server | `unit/call-ticket-rules.test.js` | Is refused when the payload was changed to make the holder the host. |
| Server | `unit/call-ticket-rules.test.js` | Is refused when it was signed with another secret. |
| Server | `unit/call-ticket-rules.test.js` | Is refused when it uses the “none” algorithm. |
| Server | `unit/call-ticket-rules.test.js` | Gives each booking its own random-looking room name that cannot be worked out from the number. |
| Server | `unit/call-ticket-rules.test.js` | Is off when the secret is short or the address is not wss. |
| Client | `pages/JoinCall.test.jsx` | Starts nothing until Join is pressed. |
| Client | `pages/JoinCall.test.jsx` | Asks an anonymous booker for the booking code. |
| Client | `pages/JoinCall.test.jsx` | Sends the booking code in the body and no login when anonymous. |
| Client | `pages/JoinCall.test.jsx` | Sends no code when signed in. |
| Client | `pages/JoinCall.test.jsx` | Shows the call screen for a call held inside the platform. |
| Client | `pages/JoinCall.test.jsx` | Sends a student to My activity and a lawyer to the Calendar after they leave the call. |
| Client | `pages/JoinCall.test.jsx` | Shows an error and stays on the page when the join is refused. |
| Client | `pages/JoinCall.test.jsx` | Offers the Meet link when it is https. |
| Client | `pages/JoinCall.test.jsx` | Frames a video room only on a daily.co address. |
| Client | `components/CallRoom.test.jsx` | Tells the guest to wait and shows no call controls yet. |
| Client | `components/CallRoom.test.jsx` | Lets the lawyer admit or turn away someone at the door. |
| Client | `components/CallRoom.test.jsx` | Never shows the admit buttons to the guest. |
| Client | `components/CallRoom.test.jsx` | Has microphone, camera, full screen and leave controls, and passes the presses on. |
| Client | `components/CallRoom.test.jsx` | Offers Flip camera only when the device has a second camera. |
| Client | `components/CallRoom.test.jsx` | Hides Flip camera when there is one camera. |
| Client | `components/CallRoom.test.jsx` | Says so when the other person turns their camera off. |
| Client | `components/CallRoom.test.jsx` | Calls the lawyer’s button End call for everyone. |
| Client | `components/CallRoom.test.jsx` | Lets the guest leave, which closes their side and goes back. |
| Client | `components/CallRoom.test.jsx` | Says the lawyer ended the call and offers to join again. |
| Client | `components/CallRoom.test.jsx` | Offers no way to rejoin straight after a deliberate leave. |
| Client | `lib/callState.test.js` | Waits in the lobby until someone knocks, then shows the knock. |
| Client | `lib/callState.test.js` | Starts the call only after the lawyer admits. |
| Client | `lib/callState.test.js` | Goes back to the lobby, and says so, when the guest leaves. |
| Client | `lib/callState.test.js` | Waits to be admitted and does not start the call on its own. |
| Client | `lib/callState.test.js` | Starts when admitted and is told plainly when refused. |
| Client | `lib/callState.test.js` | Ends with a clear reason when the lawyer ends it for everyone, and keeps that reason. |
| Client | `lib/callState.test.js` | Keeps the call going when only the link to the room drops. |
| Client | `lib/callState.test.js` | Shows the other person’s microphone and camera state. |
| Client | `lib/callState.test.js` | Fails when the ticket is refused, but not on a harmless message error. |
| Client | `lib/callSignal.test.js` | Sends the ticket as a protocol and in hello, and keeps it out of the address. |
| Client | `lib/callSignal.test.js` | Passes on messages and ignores text that is not a JSON object. |
| Client | `lib/callSignal.test.js` | Reports the close code from the room. |
| Client | `lib/callSignal.test.js` | Says bye when the person leaves, and does not report that close as a drop. |
| Browser | `e2e/journey-questions-and-booking.spec.js` | A visitor books anonymously, saves the code, and checks the booking and gets the join link. |
| Worker | `ticket.test.js` | Accepts a good ticket and returns its claims. |
| Worker | `ticket.test.js` | Rejects a bad signature. |
| Worker | `ticket.test.js` | Rejects a tampered payload. |
| Worker | `ticket.test.js` | Rejects alg none. |
| Worker | `ticket.test.js` | Rejects another alg even when signed with the secret. |
| Worker | `ticket.test.js` | Rejects an expired ticket. |
| Worker | `ticket.test.js` | Rejects a ticket with a missing or wrong claim. |
| Worker | `ticket.test.js` | Rejects a ticket for a different room than the URL. |
| Worker | `ticket.test.js` | Rejects junk. |
| Worker | `index.test.js` | Answers /health with ok. |
| Worker | `index.test.js` | Returns 404 for other paths. |
| Worker | `index.test.js` | Returns 426 for a non-upgrade request to a room. |
| Worker | `index.test.js` | Refuses a missing Origin with 403 before the subprotocol check. |
| Worker | `index.test.js` | Refuses an unlisted Origin with 403 before the subprotocol check. |
| Worker | `index.test.js` | Sets no cookies. |
| Worker | `index.test.js` | Answers 401 with no subprotocol and never touches the namespace. |
| Worker | `index.test.js` | Answers 401 when the first entry is wrong. |
| Worker | `index.test.js` | Answers 401 when there are not exactly two entries. |
| Worker | `index.test.js` | Answers 401 for a ticket made for another room. |
| Worker | `index.test.js` | Answers 401 for an expired ticket. |
| Worker | `index.test.js` | Answers 401 for a ticket signed with another secret. |
| Worker | `index.test.js` | Upgrades with 101 and selects alu-call.v1 for a good ticket. |
| Worker | `index.test.js` | Runs hello, knock, admit and signal through the Durable Object. |
| Worker | `index.test.js` | Still checks the hello ticket inside the Durable Object. |
| Worker | `index.test.js` | Keeps rooms apart. |
| Worker | `room.test.js` | Answers a good hello with ready. |
| Worker | `room.test.js` | Rejects a bad ticket with bad_ticket and closes 4001. |
| Worker | `room.test.js` | Rejects a ticket made for another room. |
| Worker | `room.test.js` | Closes 4001 when no hello arrives within 5 seconds. |
| Worker | `room.test.js` | Does not close an authenticated socket at 5 seconds. |
| Worker | `room.test.js` | Refuses other messages before hello. |
| Worker | `room.test.js` | Refuses a second hello. |
| Worker | `room.test.js` | Tells a joiner whether the peer is present. |
| Worker | `room.test.js` | Replaces an older connection of the same role with 4002. |
| Worker | `room.test.js` | Does not tell the guest the peer left when a host is replaced. |
| Worker | `room.test.js` | Knocks the host when a guest joins. |
| Worker | `room.test.js` | Knocks when the host connects after a guest is waiting. |
| Worker | `room.test.js` | Admit sends admitted to the guest and start to the host. |
| Worker | `room.test.js` | Deny sends denied then closes the guest with 4003. |
| Worker | `room.test.js` | A guest cannot admit or deny. |
| Worker | `room.test.js` | Refuses guest signal until admitted. |
| Worker | `room.test.js` | Refuses host signal until a guest is admitted. |
| Worker | `room.test.js` | Relays signals both ways after admission. |
| Worker | `room.test.js` | Rejects signal data that is not an object. |
| Worker | `room.test.js` | Keeps an admitted guest admitted after a reconnect. |
| Worker | `room.test.js` | Does not keep admission for a guest who was never admitted. |
| Worker | `room.test.js` | Tells the other side when a socket closes. |
| Worker | `room.test.js` | Bye tells the other side and closes the sender. |
| Worker | `room.test.js` | A guest who says bye must be let in again. |
| Worker | `room.test.js` | A host who says bye ends the admission. |
| Worker | `room.test.js` | A replaced socket that says bye does not end the new admission. |
| Worker | `room.test.js` | Answers ping with pong. |
| Worker | `room.test.js` | Answers invalid JSON and unknown types with bad_message. |
| Worker | `room.test.js` | Closes 4004 for a message over 16 KB. |
| Worker | `room.test.js` | Accepts a message of exactly 16 KB. |
| Worker | `room.test.js` | Counts bytes, not characters. |
| Worker | `room.test.js` | Allows 60 messages in 10 seconds and stops the 61st with 4005. |
| Worker | `room.test.js` | Lets the count recover after the window passes. |
| Worker | `room.test.js` | Sets the alarm to the latest ticket exp. |
| Worker | `room.test.js` | Closes every socket with 4006 and clears state when it fires. |
| Worker | `room.test.js` | Is false before admission and true for a reconnecting admitted guest. |
| Worker | `room.test.js` | Refuses a denied guest who was admitted and reconnects. |
| Worker | `room.test.js` | Refuses a never admitted guest after a deny and does not knock. |
| Worker | `room.test.js` | Refuses a host admit after a deny. |
| Worker | `room.test.js` | Does not refuse the host after a deny. |
| Worker | `room.test.js` | Resets when the alarm fires. |
| Worker | `room.test.js` | Guest reconnect gives the guest ready then admitted and the host start. |
| Worker | `room.test.js` | Host reconnect gives the host ready then start and the guest admitted. |
| Worker | `room.test.js` | Does not fire when the other side is absent. |
| Worker | `room.test.js` | Does not fire for a guest who was never admitted. |
| Worker | `room.test.js` | Does not fire on a reconnect after deny. |
| Worker | `room.test.js` | First admission still sends admitted and start once. |

### 7. Ask AI

| Level | File | What it checks |
|---|---|---|
| Server | `integration/ask-ai.test.js` | Answers from the published guide and names it as the source. |
| Server | `integration/ask-ai.test.js` | Says the limit was reached with a 429 and a retry time when Google answers 429. |
| Server | `integration/ask-ai.test.js` | Says it is busy for a moment with a 503 when Google is overloaded. |
| Server | `integration/ask-ai.test.js` | Gives nothing away for any other failure. |
| Server | `integration/ask-ai.test.js` | Refuses an answer that holds a figure the guide does not have. |
| Client | `pages/AskAI.test.jsx` | Sends nothing until the person ticks I understand. |
| Client | `pages/AskAI.test.jsx` | Says plainly that it is not available when the model is not set up. |
| Client | `pages/AskAI.test.jsx` | Shows a clear message and no answer when the model fails. |

### 8. Account erasure

| Level | File | What it checks |
|---|---|---|
| Server | `integration/erase-account.test.js` | Needs a login. |
| Server | `integration/erase-account.test.js` | Refuses a wrong password and deletes nothing. |
| Server | `integration/erase-account.test.js` | Keeps the account of a legal expert, who is not erased this way. |
| Server | `integration/erase-account.test.js` | Removes the person, their matters, files and questions, and leaves other people alone. |
| Server | `integration/erase-account.test.js` | Ends the old sign-in. |
| Server | `integration/erase-account.test.js` | Keeps a booking for the lawyer but with no name, no account and no topic. |
| Server | `integration/erase-account.test.js` | Keeps the account and shows no stack trace when a stored file cannot be removed. |
| Client | `pages/AccountDelete.test.jsx` | Sends nothing until the password is typed and the box is ticked. |
| Client | `pages/AccountDelete.test.jsx` | Sends the password and the confirmation, clears the session and goes to the front page. |
| Client | `pages/AccountDelete.test.jsx` | Shows the server message on a wrong password and stays signed in. |
| Client | `pages/AccountDelete.test.jsx` | Gives a legal expert no delete button and tells them to ask an admin. |

### 9. Error handling

| Level | File | What it checks |
|---|---|---|
| Server | `integration/errors.test.js` | Answers a path nothing matched with a JSON message and not a web page. |
| Server | `integration/errors.test.js` | Answers broken JSON with a 400 and a plain message. |
| Server | `integration/errors.test.js` | Refuses a body over 100 kb. |
| Server | `integration/errors.test.js` | Sends only an error message, never a stack trace or a file path. |

### 10. Accessibility basics in the browser

| Level | File | What it checks |
|---|---|---|
| Browser | `e2e/journey-accessibility.spec.js` | The main menu is reached by keyboard in order, with the emergency numbers before the search. |
| Browser | `e2e/journey-accessibility.spec.js` | The control you have reached by keyboard shows a visible focus ring. |
| Browser | `e2e/journey-accessibility.spec.js` | Every footer link is at least 44 px high, at 1440 px and at 390 px wide. |

## What these tests do not cover

- Editing guides, directory entries, routes and checklists in the admin pages, and the “I understand” step before an edit un-publishes a record.
- The calendar and appointments pages, and the menus and overview pages.
- Uploading, encrypting and sharing matter documents.
- Rate limits, password reset, email change and the security headers of the website.
- A real camera, a real microphone and the relay on real phones. Those are checked by hand.
- The Tab order in Safari. It does not Tab to links by default, so the browser test focuses each link directly there.
- The Ask AI answers themselves. The tests check that the page and the server behave correctly around the model, not what the model says.

# Test plan

This page says what is tested, how, what the tests found and what is not tested. The numbers were measured when this page was written.

## Approach

The platform makes promises to its users. The most important is that nothing reaches the public until the admin publishes it. The tests are built around those promises. Each promise is checked at the lowest level where it can break and again higher up where a person would meet it.

| Level | Tool | What it checks | Count |
|---|---|---|---|
| API and database | Jest and Supertest against a real PostgreSQL | The rules, the roles, the database constraints and the emails | 810 tests in 45 suites |
| Pages and components | Vitest and Testing Library | What each page shows and sends, for each kind of person | 996 tests in 83 files |
| Browser | Playwright at 390 pixels wide in Chromium, Firefox and WebKit | Whole journeys on a phone, touch target sizes and sideways scrolling | 197 tests in 17 files |

The API tests use a real database and not a pretend one. A database constraint is one of the rules. A pretend database could not break it.

## How the tests are run

```bash
cd server && npm test                     # needs the alu_legal_test database
cd client && npm test                     # no server needed
cd client && npm run e2e                  # no server needed
```

- **API tests.** Each run makes its own private schema inside the test database, applies the migrations and drops it at the end. Two runs at once cannot disturb each other.
- **Page tests.** Each test replaces the network with a fixed reply. A test that makes a call it did not plan for fails loudly. It never reaches a real server.
- **Browser tests.** The API is replaced by fixed replies from `client/tests/e2e/support.js`. A fixed path wins over a path with a parameter, as in the real server. Every name, address and code in the data is made up.

## The promises and where they are tested

| Promise | API tests | Page tests | Browser tests |
|---|---|---|---|
| Nothing is public until the admin publishes it. Only the admin can | `guides`, `directory-providers`, `matter-routes`, `checklists`, `admin-access` | Each admin CMS page has its own Publish control, and only that role can reach it | A legal expert cannot reach any admin CMS page |
| Editing a published guide takes it off the site | `guides` | The editor sends no request until the admin ticks "I understand" | The same, in a browser |
| A published row always has a verifier | `migrations`, `guides`, `directory-providers` | | |
| Anonymous means anonymous | `questions`, `bookings`, `anon-token` | The anonymous request is sent without the login. The code is shown once and kept out of the address | The code is never in the address bar and the request has no login |
| A signed-in person chooses between their name and anonymous | | Nothing is pre-selected and the button stays off | The same in a browser |
| Logging out really logs out | `auth`, `auth-middleware`, `password` | Sign out clears the session even when the server cannot be reached | Signing out clears the saved login |
| Changing the email address is safe | `change-email` | The form asks for the new address and the password first and shows the waiting address | |
| Matters are private | `matters`, `matters-sharing` | An expert sees no reminders and cannot change or delete | Sharing and stopping sharing |
| Reminders are never late | `reminders`, `reminder-dates` | Reminders are listed in words | The reminders show on a new matter |
| Experts join by invitation only | `auth`, `admin-invites`, `admin-users` | Legal expert is never offered as a role | An admin cannot switch off their own account |
| Responses list their fields one by one | `admin-users`, `auth` | | |
| Rate limits | `rate-limit`, `bookings-rate-limit`, `questions-rate-limit` | The page shows the server's message | |
| The urgent numbers are always there | `emergency-contacts` | The page shows the numbers before anything loads | The numbers show with the server down |

## Design and accessibility checks

| Check | How |
|---|---|
| Colour contrast of the text and the form borders | `tests/lib/tokens.test.js` computes it from the real colours |
| No colour used with an opacity suffix that Tailwind would drop | The same file reads every source file |
| Touch targets of 44 by 44 pixels | The browser test measures every link and button in the header |
| No page makes a phone scroll sideways | The browser test checks eight pages |
| The Emergency numbers link comes before the menu by keyboard | The browser test presses Tab |
| The disclaimer is in every footer | The browser test visits six pages |
| A word or icon goes with every colour | Pages are tested by their words. Status pills are tested for their text |
| No AI or assistant anywhere | The browser test reads the front door. A search of the source finds none |

## What the tests found

The tests found real defects while the platform was being built.

1. **A typo could sign a student out.** Changing a password with a wrong current password returned 401. The website treats every 401 as an ended session and clears the login. A page test for the form showed the person vanish. The server now returns 400 and a test pins it.
2. **A link made from stored text could run code.** A guide's source address and a booking's video address were put straight into links. A `javascript:` value would run when clicked. The server already refused it when saving. The pages now check again before they make a link. Tests try `javascript:`, `data:`, plain `http:` and text that is not an address.
3. **A test helper answered the wrong route.** In a browser test the fixed word in `/matters/share-targets` was answered by the rule for `/matters/:id`. The page then got a matter where it expected a list. The helper now prefers a fixed path, as the real server does.
4. **The change-email tests were checked by breaking the code.** Removing the line that ends older sessions made one test fail. Writing the new address straight onto the account made fifteen fail. The code was restored afterwards. This shows the tests would catch those two mistakes.
5. **Timing mistakes in tests.** Some tests looked for a button before a list had loaded. They now wait. The full suites are run more than once to catch this kind of problem.

## Not tested

Being clear about this matters.

- **Load.** No test checks how the platform behaves with many people at once.
- **Real email.** The tests check the email text and that a mail is sent. They do not send one through a real provider. A real send must be tried at deployment.
- **Other browsers.** The browser tests were run on 30 October 2026 in Chromium (197 pass), Firefox (197 pass) and WebKit, the Safari engine (193 pass). Four tests fail on WebKit every time: two check keyboard focus and two check the requests the page recorded. The cause is not yet found. They have not been run on Safari itself or on a real phone.
- **Screen readers.** The pages use labels, headings and live regions that the tests check by role. A person using a screen reader has not tried them.
- **Security by an outside party.** The code has been reviewed by its author and checked with a linter. No independent penetration test has been done.
- **The legal content.** The tests cannot say a guide is correct. The admin publishes the sample content directly; the platform itself does not enforce a lawyer's review before publication. A legal expert's role here is holding consultations and reading shared matters, not checking guide text.

## Before a release

1. Run all three suites. All must pass.
2. Run `npm run build` in the client.
3. Try a real verification email and a real reminder.
4. Open the urgent help page and check each number.
5. Walk through the main journeys once on a phone: find where a matter goes, track it, book a consultation and ask a question.

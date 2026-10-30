// The description of the API in the OpenAPI 3 format.
// Swagger UI shows it at /api/docs and the raw file is at /api/openapi.json.
//
// Every route in the server has one entry in OPS below. A test fails when a route is missing here
// or an entry here has no route. The lists of areas of law, provider categories and provider types
// are taken from the code that checks them. A new one shows up here with no edit to this file.
import { PROVIDER_CATEGORIES, PROVIDER_TYPES } from './routes/directory.js';
import { DOMAINS } from './services/domains.js';

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (item) => ({ type: 'array', items: typeof item === 'string' ? ref(item) : item });
const text = (description, extra = {}) => ({ type: 'string', description, ...extra });
const whole = (description, extra = {}) => ({ type: 'integer', description, ...extra });
const flag = (description) => ({ type: 'boolean', description });
const day = (description) => ({ type: 'string', format: 'date', description });
const moment = (description) => ({ type: 'string', format: 'date-time', description });
const obj = (properties, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const oneOf = (values, description) => ({ type: 'string', enum: values, description });

const REVIEW = ['pending', 'complete', 'needs_fix', 'out_of_date'];
const BOOKING_STATES = ['requested', 'accepted', 'declined', 'completed'];

// ------------------------------------------------------------------------------ shapes

const schemas = {
  Error: obj({ error: text('What went wrong, in words the person can act on.') }, ['error']),
  Message: obj({ message: text('A short answer.') }),

  User: obj({
    id: whole('The account number.'), name: text('The name.'), email: text('The address.'),
    role: oneOf(['student', 'staff', 'legal_expert', 'admin'], 'What the account may do.'),
  }),
  Session: obj({
    token: text('The sign-in token. Send it as "Authorization: Bearer <token>". It works for 7 days or until the account signs out.'),
    user: ref('User'),
  }),
  Me: obj({
    id: whole('The account number.'), name: text('The name.'), email: text('The address.'),
    role: oneOf(['student', 'staff', 'legal_expert', 'admin']),
    email_verified_at: moment('When the address was proved.'), created_at: moment('When the account was made.'),
  }),

  Provider: obj({
    id: whole('The entry number.'), name: text('The name.'),
    category: oneOf(PROVIDER_CATEGORIES, 'The group a person looks in first.'),
    type: oneOf(PROVIDER_TYPES, 'The kind of body.'),
    location: text('The town or district.', { nullable: true }),
    contact: text('Phone, email or a web address.', { nullable: true }),
    services: text('What the body does.', { nullable: true }),
    languages: text('The languages it works in.', { nullable: true }),
    is_free: flag('True when the service costs nothing.'),
    bookable: flag('True when a consultation can be requested on this site.'),
    address: text('The head office.', { nullable: true }), hours: text('When it is open.', { nullable: true }),
    address_note: text('What could not be confirmed about the address.', { nullable: true }),
    official_source_url: text('The body’s own page. Always https.', { nullable: true }),
    last_checked_at: day('The day the details were last checked.'),
    verified_at: moment('When an admin published it.'),
    stale: flag('True when the details were not checked in the last 180 days.'),
  }),
  ProviderStaff: obj({
    id: whole('The entry number.'), name: text('The name.'), category: oneOf(PROVIDER_CATEGORIES), type: oneOf(PROVIDER_TYPES),
    location: text('', { nullable: true }), contact: text('', { nullable: true }), services: text('', { nullable: true }),
    languages: text('', { nullable: true }), is_free: flag('Free of charge.'), address: text('', { nullable: true }),
    hours: text('', { nullable: true }), address_note: text('', { nullable: true }), official_source_url: text('', { nullable: true }),
    last_checked_at: day('The day it was last checked.'), status: oneOf(['draft', 'pending_review', 'published']),
    verified_at: moment('When it was published.'), updated_at: moment('Last change.'), stale: flag('Not checked for 180 days.'),
    user_id: whole('The legal expert account behind the entry. The public list never shows it.', { nullable: true }),
    meet_link: text('The video room of the expert.', { nullable: true }), bookable: flag('Takes consultation requests.'),
  }),
  ProviderInput: obj({
    name: text('Required on create. At most 200 characters.'),
    category: oneOf(PROVIDER_CATEGORIES), type: oneOf(PROVIDER_TYPES),
    location: text('', { nullable: true }), contact: text('', { nullable: true }), services: text('', { nullable: true }),
    languages: text('', { nullable: true }), is_free: flag('Defaults to false.'),
    official_source_url: text('A full https:// address.', { nullable: true }),
    address: text('', { nullable: true }), hours: text('', { nullable: true }), address_note: text('', { nullable: true }),
    user_id: whole('The id of an active legal expert account. Send null to unlink.', { nullable: true }),
    bookable: flag('Needs a linked legal expert account.'),
    meet_link: text('Only an https://meet.google.com/ address.', { nullable: true }),
  }),

  RouteSummary: obj({
    id: whole('The route number.'), matter_type: text('A short name made of lowercase letters, digits and underscores.'),
    title: text('The situation in the words a reader would use.'), area: oneOf(DOMAINS, 'The area of law.'),
    deadline_days: whole('Days from the start of the deadline.', { nullable: true }),
    deadline_runs_from: text('What the deadline counts from.', { nullable: true }),
    first_forum_id: whole('The directory entry that hears it first.'), first_forum_name: text('Its name.'),
    first_forum_type: oneOf(PROVIDER_TYPES), verified_at: moment('When it was published.'),
    score: { type: 'number', description: 'How well it matches the search words. 0 with no search.' },
  }),
  RouteDetail: obj({
    id: whole('The route number.'), matter_type: text('The short name.'), title: text('The situation.'),
    legal_basis: text('The law that sends the matter there.'), exclusions: text('What this does not cover.', { nullable: true }),
    steps: arrayOf(text('One step.')), deadline_days: whole('', { nullable: true }), deadline_runs_from: text('', { nullable: true }),
    deadline_note: text('', { nullable: true }), verified_at: moment('When it was published.'), first_forum: ref('Provider'),
  }),
  RouteStaff: obj({
    id: whole('The route number.'), matter_type: text(''), title: text(''), keywords: text('Words that help search.'),
    first_forum_id: whole(''), legal_basis: text(''), exclusions: text('', { nullable: true }), steps: arrayOf(text('')),
    deadline_days: whole('', { nullable: true }), deadline_runs_from: text('', { nullable: true }), deadline_note: text('', { nullable: true }),
    area: oneOf(DOMAINS), status: oneOf(['draft', 'pending_review', 'published']), verified_at: moment(''), updated_at: moment(''),
    first_forum_name: text('The office it sends people to.'), first_forum_status: oneOf(['draft', 'pending_review', 'published']),
  }),
  RouteInput: obj({
    matter_type: text('3 to 60 lowercase letters, digits or underscores. Must be new.'),
    title: text('Required.'), keywords: text('Words that help search.'),
    first_forum_id: whole('The id of the directory entry that hears it first.'),
    legal_basis: text('Required. The article that sends the matter there.'), exclusions: text('', { nullable: true }),
    steps: arrayOf(text('One step.')), deadline_days: whole('Needs deadline_runs_from too, or neither.', { nullable: true }),
    deadline_runs_from: text('', { nullable: true }), deadline_note: text('', { nullable: true }),
    area: oneOf(DOMAINS, 'The area of law.'),
  }),

  EmergencyContact: obj({ name: text('Who to call.'), contact: text('The number or address.'), when: text('When to use it.') }),
  EmergencyContactStaff: obj({
    id: whole('The contact number.'), name: text('Who to call.'), contact: text('The number or address.'),
    when_to_use: text('When to use it.'), sort_order: whole('Smaller numbers come first.'), updated_at: moment('Last change.'),
  }),
  EmergencyContactInput: obj({
    name: text('At most 200 characters.'), contact: text('At most 200 characters.'),
    when_to_use: text('At most 500 characters.'), sort_order: whole('0 to 10000. Defaults to 100 on create.'),
  }),

  SearchReply: obj({
    query: text('The words that were searched.'),
    results: obj({
      guides: arrayOf(obj({ id: whole(''), title: text(''), summary: text('', { nullable: true }), domain: oneOf(DOMAINS), source_law: text('') })),
      routes: arrayOf(obj({ id: whole(''), title: text(''), first_forum_name: text('') })),
      providers: arrayOf(obj({ id: whole(''), name: text(''), type: oneOf(PROVIDER_TYPES), location: text('', { nullable: true }), services: text('', { nullable: true }) })),
    }),
  }),

  ServiceBlock: obj({
    portal: obj({ name: text('The service, such as Irembo.'), url: text('The service page. https only.'), help_url: text('The service’s own help article. https only.') }),
    who_can_apply: text('Who may apply.'),
    fees: arrayOf(obj({ item: text(''), amount_rwf: whole('', { nullable: true }), note: text(''), source_url: text('') }, ['item'])),
    processing: obj({ text: text(''), days_min: whole(''), days_max: whole('') }),
    documents: arrayOf(obj({ name: text(''), notes: text(''), where_to_get: text(''), required_if: text(''), source_url: text('') }, ['name'])),
    offices: arrayOf(obj({ name: text(''), address: text(''), district: text(''), hours: text(''), phone: text(''), map_url: text(''), source_url: text('') }, ['name', 'address'])),
    walkthrough: arrayOf(obj({ instruction: text('One step.'), url_at_step: text('The page where the step happens. https only.') }, ['instruction'])),
    unconfirmed: arrayOf(text('Something that could not be confirmed.')),
    checked_at: day('The day the details were checked.'),
  }),
  GuideCard: obj({
    id: whole('The guide number.'), domain: oneOf(DOMAINS), title: text(''), source_law: text('The law the guide is based on.'),
    summary: text('One or two short sentences.', { nullable: true }), verified_at: moment('When it was published.'),
    has_service: flag('True when the guide has a how-to block.'),
  }),
  Guide: obj({
    id: whole('The guide number.'), domain: oneOf(DOMAINS), title: text(''), situation: text(''), law_says: text(''),
    your_rights: text(''), steps: text(''), get_help: text(''), source_law: text(''), source_url: text('', { nullable: true }),
    summary: text('', { nullable: true }), service: { ...ref('ServiceBlock'), nullable: true }, verified_at: moment('When it was published.'),
  }),
  GuideStaff: obj({
    id: whole('The guide number.'), domain: oneOf(DOMAINS), title: text(''), situation: text(''), law_says: text(''),
    your_rights: text(''), steps: text(''), get_help: text(''), source_law: text(''), source_url: text('', { nullable: true }),
    summary: text('', { nullable: true }), service: { ...ref('ServiceBlock'), nullable: true },
    status: oneOf(['draft', 'pending_review', 'published', 'withdrawn']), verified_at: moment(''), created_at: moment(''),
    updated_at: moment(''), review_comment: text('The reason on the latest withdrawal.', { nullable: true }),
  }),
  GuideInput: obj({
    domain: oneOf(DOMAINS, 'The area of law.'), title: text('At most 200 characters.'),
    situation: text('At most 20000 characters.'), law_says: text('With the article numbers.'), your_rights: text(''),
    steps: text(''), get_help: text(''), source_law: text('The law the guide is based on.'),
    source_url: text('A full https:// address.', { nullable: true }), summary: text('At most 280 characters.', { nullable: true }),
    service: { ...ref('ServiceBlock'), nullable: true },
  }, ['domain', 'title', 'situation', 'law_says', 'your_rights', 'steps', 'get_help', 'source_law']),
  Saved: obj({
    id: whole('The guide number.'), domain: oneOf(DOMAINS), title: text(''), status: oneOf(['draft', 'pending_review', 'published', 'withdrawn']),
    source_law: text(''), verified_at: moment('', { nullable: true }), bookmarked_at: moment('When it was saved.'),
  }),

  ChecklistItem: obj({
    key: text('Lowercase letters, digits and single hyphens. Unique in the list.'), name: text('The document.'),
    notes: text('', { nullable: true }), where_to_get: text('', { nullable: true }), required_if: text('', { nullable: true }),
    source_url: text('https only.', { nullable: true }), required: flag('False for a document only some people need.'),
  }, ['key', 'name']),
  ChecklistCard: obj({
    id: whole(''), slug: text(''), title: text(''), description: text('', { nullable: true }),
    item_count: whole('How many documents.'), verified_at: moment('When it was published.'),
  }),
  Checklist: obj({
    id: whole(''), slug: text(''), title: text(''), description: text('', { nullable: true }),
    items: arrayOf('ChecklistItem'), verified_at: moment('When it was published.'),
  }),
  ChecklistStaff: obj({
    id: whole(''), slug: text(''), title: text(''), description: text('', { nullable: true }), items: arrayOf('ChecklistItem'),
    status: oneOf(['draft', 'pending_review', 'published']), verified_at: moment('', { nullable: true }), updated_at: moment(''),
  }),
  ChecklistInput: obj({
    slug: text('At most 60 characters. Must be new.'), title: text('At most 200 characters.'),
    description: text('At most 1000 characters.'), items: arrayOf('ChecklistItem'),
  }, ['slug', 'title', 'items']),
  ChecklistProgress: obj({
    checklist: obj({ id: whole(''), title: text(''), under_review: flag('True while an admin is changing it. Then no items are shown.') }, []),
    items: arrayOf({
      allOf: [ref('ChecklistItem'), obj({
        state: oneOf(['missing', ...REVIEW], 'missing: no file yet. pending: a file waits for a lawyer.'),
        document: { ...ref('Document'), nullable: true },
      })],
    }),
    ready: flag('True when every required item has a file a lawyer marked complete. It is not a promise that an office will accept it.'),
  }),

  Matter: obj({
    id: whole('The matter number.'), title: text(''), status: oneOf(['open', 'closed']), next_action: text('', { nullable: true }),
    next_due: day('The next deadline.'), route_id: whole('The route it started from.', { nullable: true }),
    route_title: text('', { nullable: true }), shared_with: whole('The directory entry it is shared with.', { nullable: true }),
    shared_with_name: text('', { nullable: true }), shared_at: moment('', { nullable: true }), created_at: moment(''), updated_at: moment(''),
  }),
  MatterEvent: obj({
    id: whole(''), occurred_on: day('The day it happened.'), description: text(''), created_at: moment(''),
    author_is_owner: flag('False for a note written by a lawyer.'), author_name: text('Only ever set for the lawyer’s lines the owner reads.', { nullable: true }),
  }),
  Reminder: obj({
    id: whole(''), due_on: day('The deadline.'), send_on: day('The day it is sent.'),
    status: oneOf(['pending', 'sent', 'missed', 'cancelled']), sent_at: moment('', { nullable: true }),
  }),
  MatterDetail: obj({
    id: whole(''), title: text(''), status: oneOf(['open', 'closed']), next_action: text('', { nullable: true }), next_due: day(''),
    route_id: whole('', { nullable: true }), route_title: text('', { nullable: true }),
    shared_with: whole('Left out for the lawyer.', { nullable: true }), shared_with_name: text('', { nullable: true }),
    shared_at: moment('Left out for the lawyer.', { nullable: true }), created_at: moment(''), updated_at: moment(''),
    viewer: oneOf(['owner', 'expert'], 'Who is looking.'), events: arrayOf('MatterEvent'),
    reminders: arrayOf('Reminder'),
  }),
  ShareTarget: obj({ id: whole('The directory entry.'), name: text(''), category: oneOf(PROVIDER_CATEGORIES), type: oneOf(PROVIDER_TYPES), location: text('', { nullable: true }) }),
  SharedMatter: obj({
    id: whole(''), title: text(''), status: oneOf(['open', 'closed']), next_action: text('', { nullable: true }), next_due: day(''),
    shared_at: moment(''), updated_at: moment(''), route_title: text('', { nullable: true }), shared_with_name: text('The office the matter was shared with.'),
    documents_waiting: whole('How many documents on this matter wait for the lawyer’s check. A count only. It names nobody.'),
  }),
  MatterInput: obj({
    title: text('At most 200 characters. Left out when route_id is given.'), next_action: text('At most 2000 characters.'),
    next_due: day('The next deadline.'), route_id: whole('A published route.'),
    deadline_start: day('With route_id: the day the deadline started. The server works out the due date.'),
  }),
  MatterUpdate: obj({
    title: text(''), next_action: text('', { nullable: true }), next_due: day(''), status: oneOf(['open', 'closed']),
  }),

  Document: obj({
    id: whole('The document number.'), label: text('What the document is.'), mime: oneOf(['application/pdf', 'image/png', 'image/jpeg']),
    size_bytes: whole(''), uploaded_at: moment(''), item_key: text('The checklist item it answers.', { nullable: true }),
    review: obj({ status: oneOf(REVIEW), note: text('', { nullable: true }), reviewed_at: moment('', { nullable: true }) }),
  }),
  DocumentComment: obj({
    id: whole(''), body: text(''), created_at: moment(''),
    author_name: text('Only the owner sees the lawyer’s name. A lawyer never sees another lawyer’s name.', { nullable: true }),
    by_you: flag('True for the lawyer who wrote it.'),
  }),
  DocumentWithComments: {
    allOf: [ref('Document'), obj({ comments: arrayOf('DocumentComment') })],
  },

  Booking: obj({
    id: whole('The booking number.'), provider_id: whole('The directory entry.'), slot: moment('The time asked for.'),
    topic: text('', { nullable: true }), status: oneOf(BOOKING_STATES), created_at: moment(''),
  }),
  BookingMine: obj({
    id: whole(''), provider_id: whole(''), slot: moment(''), topic: text('', { nullable: true }), status: oneOf(BOOKING_STATES),
    created_at: moment(''), provider_name: text(''), meet_link: text('Only once the lawyer has accepted.', { nullable: true }),
  }),
  BookingExpert: obj({
    id: whole(''), provider_id: whole(''), slot: moment(''), topic: text('', { nullable: true }), status: oneOf(BOOKING_STATES),
    created_at: moment(''), meet_link: text('Only once accepted.', { nullable: true }), requester: text('The name, or "Anonymous".'),
  }),
  BookingInput: obj({
    provider_id: whole('A published directory entry that takes bookings.'),
    slot: moment('In the future and within a year.'), topic: text('At most 500 characters.'),
  }, ['provider_id', 'slot']),
  AnonBooking: obj({
    id: whole(''), provider_id: whole(''), slot: moment(''), topic: text('', { nullable: true }), status: oneOf(BOOKING_STATES),
    anon_token: text('Shown once. It cannot be recovered.'), warning: text('A reminder to save the token.'),
  }),
  AnonBookingStatus: obj({
    id: whole(''), slot: moment(''), topic: text('', { nullable: true }), status: oneOf(BOOKING_STATES),
    provider_name: text(''), meet_link: text('Only once the lawyer has accepted.', { nullable: true }),
  }),

  Question: obj({
    id: whole('The question number.'), text: text('The question.'), answer: text('Empty until answered.', { nullable: true }),
    status: oneOf(['open', 'answered']), created_at: moment(''),
  }),
  QuestionCreated: obj({ id: whole(''), text: text(''), status: oneOf(['open', 'answered']), created_at: moment('') }),
  AnonQuestionCreated: obj({
    id: whole(''), text: text(''), status: oneOf(['open', 'answered']), created_at: moment(''),
    anon_token: text('Shown once. It is the only way to read the answer.'), warning: text('A reminder to save the token.'),
  }),
  OpenQuestion: obj({
    id: whole(''), text: text(''), created_at: moment(''),
    kind: oneOf(['anonymous', 'signed-in'], 'Nothing more about who asked.'),
  }),

  AdminUser: obj({
    id: whole(''), name: text(''), email: text(''), role: oneOf(['student', 'staff', 'legal_expert', 'admin']),
    email_verified_at: moment('', { nullable: true }), deactivated_at: moment('', { nullable: true }), created_at: moment(''),
  }),
  Invite: obj({
    id: whole(''), email: text(''), expires_at: moment(''), used_at: moment('', { nullable: true }), created_at: moment(''),
    invited_by: text('The admin who sent it.'), status: oneOf(['pending', 'used', 'expired']),
  }),
  InviteCreated: obj({
    id: whole(''), email: text(''), expires_at: moment(''), message: text('Says whether the email was sent.'),
  }),
  Stats: {
    type: 'object',
    description: 'Counts only. No names, no emails and nothing about what one person did.',
    properties: {
      guides: obj({ draft: whole(''), pending_review: whole(''), published: whole('') }),
      directory: obj({
        providers: obj({ draft: whole(''), pending_review: whole(''), published: whole('') }),
        routes: obj({ draft: whole(''), pending_review: whole(''), published: whole('') }),
        stale: whole('Published entries not checked for 180 days.'),
      }),
      bookings: obj({ total: whole(''), anonymous: whole(''), by_status: obj({ requested: whole(''), accepted: whole(''), declined: whole(''), completed: whole('') }) }),
      questions: obj({ total: whole(''), anonymous: whole(''), open: whole('') }),
      matters: obj({ total: whole(''), open: whole(''), shared: whole('') }),
      reminders: obj({ pending: whole(''), sent: whole(''), missed: whole(''), cancelled: whole(''), sent_late: whole('Sent after the deadline.') }),
      users: obj({ student: whole(''), staff: whole(''), legal_expert: whole(''), admin: whole(''), deactivated: whole('') }),
    },
  },
};

// ------------------------------------------------------------------------------ the routes

const ANYONE_SIGNED_IN = ['student', 'staff', 'legal_expert', 'admin'];
const OWNERS = ['student', 'staff'];

const PARAM_NOTES = {
  id: 'The number of the record.',
  matterId: 'The matter number.',
  docId: 'The document number.',
  token: 'The anonymous token that was shown once.',
};

const STATUS_TEXT = {
  400: 'The request was refused. The message says why.',
  401: 'Not signed in, or the session has ended.',
  403: 'The account may not do this.',
  404: 'Not found. A record the caller may not see also answers 404.',
  409: 'It clashes with something that already exists or just changed.',
  410: 'It was withdrawn. The message gives the reason.',
  429: 'Too many requests. Wait and try again.',
  502: 'A message the server tried to send was not accepted.',
  503: 'The feature is switched off on this server.',
};

// One route. `o.reply` is [status, description, schema]. `o.errors` lists the other statuses it can give.
const op = (method, path, tag, summary, o = {}) => ({ method, path, tag, summary, ...o });

const OPS = [
  // ---- Server
  op('get', '/health', 'Server', 'Check that the server is running', { reply: [200, 'It is running.', obj({ status: text('Always "ok".') })] }),

  // ---- Accounts
  op('post', '/auth/register', 'Accounts', 'Create a student or staff account', {
    desc: 'Only an @alustudent.com or @alueducation.com address. No token comes back. The account cannot sign in until the emailed link is used. Legal experts join by invitation.',
    body: obj({ name: text('The name.'), email: text('An ALU address.'), password: text('At least 8 characters.'), role: oneOf(['student', 'staff'], 'What the person is.') }, ['name', 'email', 'password', 'role']),
    reply: [201, 'The account was made.', obj({ user: ref('User'), message: text('Says what happened to the email.') })], errors: [400], limited: true,
  }),
  op('post', '/auth/verify-email', 'Accounts', 'Use the emailed link to verify the address and sign in', {
    body: obj({ token: text('The token from the link.') }, ['token']), reply: [200, 'Verified and signed in.', ref('Session')], errors: [400, 403], limited: true,
  }),
  op('post', '/auth/resend-verification', 'Accounts', 'Ask for a new verification link', {
    desc: 'The answer is the same for every address, so it never shows which addresses have an account.',
    body: obj({ email: text('The address.') }, ['email']), reply: [200, 'The same message for everyone.', ref('Message')], errors: [400], limited: true,
  }),
  op('post', '/auth/login', 'Accounts', 'Sign in', {
    body: obj({ email: text('The address.'), password: text('The password.') }, ['email', 'password']),
    reply: [200, 'Signed in.', ref('Session')], errors: [400, 401, 403], limited: true,
    desc: '401 for a wrong address or password. 403 when the address is not verified yet or the account is switched off.',
  }),
  op('get', '/auth/me', 'Accounts', 'Read my own account', { roles: ANYONE_SIGNED_IN, reply: [200, 'My account.', ref('Me')] }),
  op('put', '/auth/me', 'Accounts', 'Change my name', {
    desc: 'Only the name is read. A role or an email in the body changes nothing.',
    roles: ANYONE_SIGNED_IN, body: obj({ name: text('1 to 100 characters.') }, ['name']), reply: [200, 'Saved. A fresh token comes with it.', ref('Session')], errors: [400],
  }),
  op('post', '/auth/logout', 'Accounts', 'Sign out everywhere', {
    desc: 'Ends every session the account has.', roles: ANYONE_SIGNED_IN, reply: [204, 'Signed out.'],
  }),
  op('post', '/auth/change-password', 'Accounts', 'Change my password', {
    desc: 'Ends every other session. The caller keeps a session through the new token.',
    roles: ANYONE_SIGNED_IN, limited: true, errors: [400],
    body: obj({ current_password: text('The password now.'), new_password: text('At least 8 characters.') }, ['current_password', 'new_password']),
    reply: [200, 'Changed.', ref('Session')],
  }),
  op('post', '/auth/forgot-password', 'Accounts', 'Ask for a password reset link', {
    desc: 'The answer is the same for every address.', body: obj({ email: text('The address.') }, ['email']),
    reply: [200, 'The same message for everyone.', ref('Message')], errors: [400], limited: true,
  }),
  op('post', '/auth/reset-password', 'Accounts', 'Set a new password with the emailed link', {
    desc: 'Signs the person in and ends every older session.',
    body: obj({ token: text('The token from the link.'), password: text('At least 8 characters.') }, ['token', 'password']),
    reply: [200, 'Changed and signed in.', ref('Session')], errors: [400], limited: true,
  }),
  op('post', '/auth/redeem-invite', 'Accounts', 'Use an invitation to become a legal expert', {
    desc: 'The only way to get the legal_expert role.',
    body: obj({ invite_token: text('The token from the invitation.'), name: text('1 to 100 characters.'), password: text('At least 8 characters.') }, ['invite_token', 'name', 'password']),
    reply: [201, 'The account was made and signed in.', ref('Session')], errors: [400], limited: true,
  }),

  // ---- Directory
  op('get', '/directory/providers', 'Directory', 'List the published directory entries', {
    query: [
      { name: 'category', schema: oneOf(PROVIDER_CATEGORIES), description: 'Keep one group.' },
      { name: 'type', schema: oneOf(PROVIDER_TYPES), description: 'Keep one kind of body.' },
      { name: 'free', schema: oneOf(['true']), description: 'Only free services.' },
      { name: 'q', schema: text(''), description: 'Words in the name, place or services.' },
    ],
    reply: [200, 'Published entries, bookable ones first.', arrayOf('Provider')],
  }),
  op('get', '/directory/providers/all', 'Directory', 'List every entry in every state', {
    roles: ['admin'], reply: [200, 'All entries.', arrayOf('ProviderStaff')],
  }),
  op('get', '/directory/providers/{id}', 'Directory', 'Read one published entry', {
    desc: 'A draft and an id that does not exist both answer 404.', reply: [200, 'The entry.', ref('Provider')], errors: [404],
  }),
  op('post', '/directory/providers', 'Directory', 'Add an entry as a draft', {
    roles: ['admin'], body: ref('ProviderInput'), reply: [201, 'The new draft.', ref('ProviderStaff')], errors: [400],
  }),
  op('put', '/directory/providers/{id}', 'Directory', 'Change an entry', {
    desc: 'A field left out keeps its value. A field sent as null is cleared. Changing a checked fact on a published entry sends it back to draft. Changing the linked expert account ends every matter shared with the entry.',
    roles: ['admin'], body: ref('ProviderInput'), reply: [200, 'The entry after the change.', ref('ProviderStaff')], errors: [400, 404],
  }),
  op('post', '/directory/providers/{id}/publish', 'Directory', 'Publish an entry', {
    roles: ['admin'], reply: [200, 'Published.', obj({ id: whole(''), status: text('"published".') })], errors: [400],
  }),

  // ---- Where to go
  op('get', '/directory/routes', 'Where to go', 'Find which body a kind of matter goes to first', {
    query: [
      { name: 'q', schema: text(''), description: 'Words about what happened. The best match comes first.' },
      { name: 'area', schema: oneOf(DOMAINS), description: 'Keep one area of law.' },
    ],
    reply: [200, 'Published routes whose first body is also published.', arrayOf('RouteSummary')],
  }),
  op('get', '/directory/routes/all', 'Where to go', 'List every route in every state', {
    roles: ['admin'], reply: [200, 'All routes.', arrayOf('RouteStaff')],
  }),
  op('get', '/directory/routes/{id}', 'Where to go', 'Read one route in full', {
    desc: 'The law, the steps, the deadline and the first body.', reply: [200, 'The route.', ref('RouteDetail')], errors: [404],
  }),
  op('post', '/directory/routes', 'Where to go', 'Add a route as a draft', {
    roles: ['admin'], body: ref('RouteInput'), reply: [201, 'The new draft.', ref('RouteStaff')], errors: [400, 409],
  }),
  op('put', '/directory/routes/{id}', 'Where to go', 'Change a route', {
    desc: 'Any edit sends the route back to draft.', roles: ['admin'], body: ref('RouteInput'),
    reply: [200, 'The route after the change.', ref('RouteStaff')], errors: [400, 404, 409],
  }),
  op('post', '/directory/routes/{id}/publish', 'Where to go', 'Publish a route', {
    roles: ['admin'], reply: [200, 'Published.', obj({ id: whole(''), status: text('"published".') })], errors: [400],
  }),

  // ---- Urgent numbers and search
  op('get', '/emergency-contacts', 'Urgent numbers', 'List the urgent help numbers', {
    desc: 'Never empty. A built-in list is sent when the table is empty or the database cannot be read.',
    reply: [200, 'The numbers.', arrayOf('EmergencyContact')],
  }),
  op('get', '/search', 'Search', 'Search guides, routes and directory entries', {
    query: [
      { name: 'q', required: true, schema: text('2 to 100 characters.'), description: 'The words to look for. Every word must match.' },
      { name: 'library', schema: oneOf(['all', 'guides', 'routes', 'providers']), description: 'Search one list. The default is all.' },
    ],
    reply: [200, 'Up to a few results from each list.', ref('SearchReply')], errors: [400], limited: true,
  }),

  // ---- Guides
  op('get', '/guides', 'Guides', 'List the published guides', {
    query: [
      { name: 'domain', schema: oneOf(DOMAINS), description: 'Keep one area of law.' },
      { name: 'search', schema: text(''), description: 'Words in the title, the situation or the law.' },
    ],
    reply: [200, 'Cards without the full text.', arrayOf('GuideCard')],
  }),
  op('get', '/guides/all', 'Guides', 'List every guide in every state', {
    roles: ['admin'], reply: [200, 'All guides.', arrayOf('GuideStaff')],
  }),
  op('get', '/guides/{id}', 'Guides', 'Read one published guide', {
    desc: '404 for a draft or an id that does not exist. 410 with the reason for a withdrawn guide.',
    reply: [200, 'The guide.', ref('Guide')], errors: [404, 410],
  }),
  op('post', '/guides', 'Guides', 'Write a guide as a draft', {
    roles: ['admin'], body: ref('GuideInput'), reply: [201, 'The new draft.', ref('GuideStaff')], errors: [400],
  }),
  op('put', '/guides/{id}', 'Guides', 'Change a guide', {
    desc: 'Any edit sends the guide back to draft. A field left out keeps its value.',
    roles: ['admin'], body: ref('GuideInput'), reply: [200, 'The guide after the change.', ref('GuideStaff')], errors: [400, 404],
  }),
  op('post', '/guides/{id}/publish', 'Guides', 'Publish a guide', {
    roles: ['admin'], reply: [200, 'Published.', obj({ id: whole(''), status: text('"published".') })], errors: [400],
  }),
  op('post', '/guides/{id}/withdraw', 'Guides', 'Take a published guide off the site', {
    roles: ['admin'], body: obj({ comment: text('Why it is withdrawn. Required.') }, ['comment']),
    reply: [200, 'Withdrawn.', obj({ id: whole(''), status: text('"withdrawn".') })], errors: [400],
  }),

  // ---- Saved guides
  op('get', '/bookmarks', 'Saved guides', 'List my saved guides', { roles: OWNERS, reply: [200, 'Newest first.', arrayOf('Saved')] }),
  op('post', '/guides/{id}/bookmark', 'Saved guides', 'Save a guide', {
    desc: 'Only a published guide can be saved. Saving twice is not an error.', roles: OWNERS,
    reply: [201, 'Saved.', obj({ guide_id: whole(''), bookmarked: flag('Always true.') })], errors: [404],
  }),
  op('delete', '/guides/{id}/bookmark', 'Saved guides', 'Remove a saved guide', { roles: OWNERS, reply: [204, 'Removed.'], errors: [404] }),

  // ---- Checklists
  op('get', '/checklists', 'Checklists', 'List the published document checklists', { reply: [200, 'The checklists.', arrayOf('ChecklistCard')] }),
  op('get', '/checklists/all', 'Checklists', 'List every checklist in every state', { roles: ['admin'], reply: [200, 'All checklists.', arrayOf('ChecklistStaff')] }),
  op('get', '/checklists/{id}', 'Checklists', 'Read one published checklist', { reply: [200, 'The checklist.', ref('Checklist')], errors: [404] }),
  op('post', '/checklists', 'Checklists', 'Write a checklist as a draft', {
    roles: ['admin'], body: ref('ChecklistInput'), reply: [201, 'The new draft.', ref('ChecklistStaff')], errors: [400, 409],
  }),
  op('put', '/checklists/{id}', 'Checklists', 'Change a checklist', {
    desc: 'Any edit sends the checklist back to draft. A field left out keeps its value.',
    roles: ['admin'], body: ref('ChecklistInput'), reply: [200, 'The checklist after the change.', ref('ChecklistStaff')], errors: [400, 404, 409],
  }),
  op('post', '/checklists/{id}/publish', 'Checklists', 'Publish a checklist', {
    roles: ['admin'], reply: [200, 'Published.', ref('ChecklistStaff')], errors: [400],
  }),

  // ---- Consultations
  op('post', '/bookings', 'Consultations', 'Ask for a consultation in my own name', {
    roles: OWNERS, body: ref('BookingInput'), reply: [201, 'The request.', ref('Booking')], errors: [400],
  }),
  op('post', '/bookings/anonymous', 'Consultations', 'Ask for a consultation without giving a name', {
    desc: 'Stores no name and no account. Any login is ignored. The token is shown once.',
    body: ref('BookingInput'), reply: [201, 'The request and its token.', ref('AnonBooking')], errors: [400], limited: true,
  }),
  op('get', '/bookings/mine', 'Consultations', 'List my consultation requests', {
    desc: 'The video room appears only once the lawyer has accepted.', roles: OWNERS, reply: [200, 'Newest first.', arrayOf('BookingMine')],
  }),
  op('get', '/bookings/anon/{token}', 'Consultations', 'Check an anonymous request with its token', {
    reply: [200, 'The request.', ref('AnonBookingStatus')], errors: [404], limited: true,
  }),
  op('get', '/bookings/expert', 'Consultations', 'List the requests for my directory entry', {
    desc: 'An anonymous requester is shown as "Anonymous".', roles: ['legal_expert'], reply: [200, 'Soonest first.', arrayOf('BookingExpert')],
  }),
  op('post', '/bookings/{id}/status', 'Consultations', 'Accept, decline or complete a request', {
    desc: 'A request moves forward only. Accepting emails the person if they signed in.',
    roles: ['legal_expert'], body: obj({ status: oneOf(['accepted', 'declined', 'completed'], 'The new state.') }, ['status']),
    reply: [200, 'The request after the change.', ref('Booking')], errors: [400, 404, 409],
  }),

  // ---- Questions
  op('post', '/questions', 'Questions', 'Ask a legal expert in my own name', {
    roles: OWNERS, body: obj({ text: text('At most 5000 characters.') }, ['text']), reply: [201, 'The question.', ref('QuestionCreated')], errors: [400],
  }),
  op('post', '/questions/anonymous', 'Questions', 'Ask a legal expert without giving a name', {
    desc: 'Stores no name and no account. Any login is ignored. The token is shown once.',
    body: obj({ text: text('At most 5000 characters.') }, ['text']), reply: [201, 'The question and its token.', ref('AnonQuestionCreated')], errors: [400], limited: true,
  }),
  op('get', '/questions/mine', 'Questions', 'List my questions and their answers', { roles: OWNERS, reply: [200, 'Newest first.', arrayOf('Question')] }),
  op('get', '/questions/anon/{token}', 'Questions', 'Read the answer to an anonymous question', {
    reply: [200, 'The question.', ref('Question')], errors: [404], limited: true,
  }),
  op('get', '/questions/open', 'Questions', 'List the questions waiting for an answer', {
    desc: 'Says whether the question is anonymous and nothing more about who asked.', roles: ['legal_expert'], reply: [200, 'Oldest first.', arrayOf('OpenQuestion')],
  }),
  op('post', '/questions/{id}/answer', 'Questions', 'Answer a question', {
    roles: ['legal_expert'], body: obj({ answer: text('At most 10000 characters.') }, ['answer']),
    reply: [200, 'Answered.', obj({ id: whole(''), status: text('"answered".') })], errors: [400, 404],
  }),

  // ---- Matters
  op('get', '/matters', 'Matters', 'List my matters', { roles: OWNERS, reply: [200, 'Soonest deadline first, closed matters last.', arrayOf('Matter')] }),
  op('post', '/matters', 'Matters', 'Open a matter', {
    desc: 'It can start from a route. With a route and deadline_start the server works out the due date from the checked number of days.',
    roles: OWNERS, body: ref('MatterInput'),
    reply: [201, 'The matter and its reminders.', { allOf: [ref('Matter'), obj({ reminders: arrayOf('Reminder') })] }], errors: [400],
  }),
  op('get', '/matters/share-targets', 'Matters', 'List who a matter can be shared with', {
    roles: OWNERS, reply: [200, 'Published entries that have a legal expert account.', arrayOf('ShareTarget')],
  }),
  op('get', '/matters/shared', 'Matters', 'List the matters shared with my directory entry', {
    desc: 'The owner is not named.', roles: ['legal_expert'], reply: [200, 'Soonest deadline first.', arrayOf('SharedMatter')],
  }),
  op('get', '/matters/{id}', 'Matters', 'Read one matter with its record and reminders', {
    desc: 'The owner, or the legal expert it is shared with. Anyone else gets 404.',
    roles: [...OWNERS, 'legal_expert'], reply: [200, 'The matter.', ref('MatterDetail')], errors: [404],
  }),
  op('put', '/matters/{id}', 'Matters', 'Change a matter', {
    desc: 'The owner only. A new due date makes new reminders. Closing cancels them.', roles: OWNERS, body: ref('MatterUpdate'),
    reply: [200, 'The matter after the change.', ref('Matter')], errors: [400, 404],
  }),
  op('post', '/matters/{id}/events', 'Matters', 'Write a line in the record of a matter', {
    desc: 'The owner. The lawyer too, while the matter is shared.', roles: [...OWNERS, 'legal_expert'],
    body: obj({ description: text('At most 2000 characters.'), occurred_on: day('Not in the future. Defaults to today in Kigali.') }, ['description']),
    reply: [201, 'The line.', ref('MatterEvent')], errors: [400, 404],
  }),
  op('post', '/matters/{id}/share', 'Matters', 'Share a matter with one office', {
    desc: 'The owner only. It replaces any earlier share.', roles: OWNERS, body: obj({ provider_id: whole('A published entry that has a legal expert account.') }, ['provider_id']),
    reply: [200, 'The matter after sharing.', ref('Matter')], errors: [400, 404],
  }),
  op('delete', '/matters/{id}/share', 'Matters', 'Stop sharing a matter', {
    desc: 'The owner only. The lawyer loses access on the next request.', roles: OWNERS, reply: [200, 'The matter after stopping.', ref('Matter')], errors: [400, 404],
  }),
  op('post', '/matters/{id}/checklist', 'Matters', 'Follow a published checklist', {
    desc: 'The owner only. The matter then shows which documents are still missing.', roles: OWNERS,
    body: obj({ checklist_id: whole('A published checklist.') }, ['checklist_id']),
    reply: [200, 'Following.', obj({ checklist_id: whole(''), title: text('') })], errors: [400, 404],
  }),
  op('delete', '/matters/{id}/checklist', 'Matters', 'Stop following a checklist', {
    desc: 'The owner only. The documents stay.', roles: OWNERS, reply: [200, 'Not following.', obj({ checklist_id: { type: 'integer', nullable: true, description: 'Always null.' } })], errors: [404],
  }),
  op('delete', '/matters/{id}', 'Matters', 'Delete a matter', {
    desc: 'The owner only. The record, the reminders and every document go with it.', roles: OWNERS, reply: [204, 'Deleted.'], errors: [404],
  }),

  // ---- Matter documents
  op('get', '/matters/{matterId}/documents/checklist', 'Matter documents', 'Show each item of the followed checklist with its file', {
    desc: 'The owner, or the legal expert the matter is shared with.', roles: ['student', 'staff', 'legal_expert'],
    reply: [200, 'The progress.', ref('ChecklistProgress')], errors: [404],
  }),
  op('get', '/matters/{matterId}/documents', 'Matter documents', 'List the documents on a matter', {
    desc: 'The owner, or the legal expert the matter is shared with.', roles: ['student', 'staff', 'legal_expert'],
    reply: [200, 'The documents with their comments.', arrayOf('DocumentWithComments')], errors: [404],
  }),
  op('post', '/matters/{matterId}/documents', 'Matter documents', 'Attach a document', {
    desc: 'The owner only. The body is the file itself: a PDF, a PNG or a JPEG, sent as raw bytes. It is stored encrypted. At most 25 documents on a matter and 100 for a person.',
    roles: ['student', 'staff', 'legal_expert'], limited: true,
    query: [
      { name: 'label', required: true, schema: text('At most 120 characters.'), description: 'What the document is.' },
      { name: 'replaces', schema: whole(''), description: 'The number of an older document this one replaces. The new file starts unchecked.' },
      { name: 'item', schema: text(''), description: 'The key of the checklist item this file answers.' },
    ],
    rawBody: ['application/pdf', 'image/png', 'image/jpeg'],
    reply: [201, 'The document.', ref('Document')], errors: [400, 404, 409, 503],
  }),
  op('put', '/matters/{matterId}/documents/{docId}/review', 'Matter documents', 'Record a verdict on a document', {
    desc: 'The legal expert the matter is shared with at this moment. The owner cannot check their own documents. A note is required unless the verdict is complete.',
    roles: ['student', 'staff', 'legal_expert'],
    body: obj({ status: oneOf(['complete', 'needs_fix', 'out_of_date'], 'The verdict.'), note: text('At most 1000 characters.') }, ['status']),
    reply: [200, 'The document with the verdict.', ref('Document')], errors: [400, 404],
  }),
  op('post', '/matters/{matterId}/documents/{docId}/comments', 'Matter documents', 'Comment on a document', {
    desc: 'The legal expert the matter is shared with at this moment. A comment is separate from the verdict. At most 50 for a document.',
    roles: ['student', 'staff', 'legal_expert'], body: obj({ body: text('At most 1000 characters.') }, ['body']),
    reply: [201, 'The comment.', ref('DocumentComment')], errors: [400, 404],
  }),
  op('get', '/matters/{matterId}/documents/{docId}/file', 'Matter documents', 'Download a document', {
    desc: 'The owner, or the legal expert the matter is shared with.', roles: ['student', 'staff', 'legal_expert'],
    reply: [200, 'The file as it was uploaded.', null, ['application/pdf', 'image/png', 'image/jpeg']], errors: [404],
  }),
  op('delete', '/matters/{matterId}/documents/{docId}', 'Matter documents', 'Delete a document', {
    desc: 'The owner only.', roles: ['student', 'staff', 'legal_expert'], reply: [204, 'Deleted.'], errors: [404],
  }),

  // ---- Administration
  op('post', '/admin/invites', 'Administration', 'Invite a legal expert by email', {
    roles: ['admin'], body: obj({ email: text('The address to invite.'), expires_days: whole('1 to 30. Defaults to 7.') }, ['email']),
    reply: [201, 'The invitation was made.', ref('InviteCreated')], errors: [400, 502],
  }),
  op('get', '/admin/invites', 'Administration', 'List the invitations', {
    desc: 'The token is never in the list.', roles: ['admin'], reply: [200, 'Newest first.', arrayOf('Invite')],
  }),
  op('get', '/admin/users', 'Administration', 'List the accounts', { roles: ['admin'], reply: [200, 'Newest first.', arrayOf('AdminUser')] }),
  op('put', '/admin/users/{id}/role', 'Administration', 'Change the role of an account', {
    desc: 'The role legal_expert cannot be given here. The role of a legal expert cannot be changed. The last active admin cannot be demoted.',
    roles: ['admin'], body: obj({ role: oneOf(['student', 'staff', 'admin'], 'The new role.') }, ['role']),
    reply: [200, 'The account.', ref('AdminUser')], errors: [400, 404],
  }),
  op('post', '/admin/users/{id}/deactivate', 'Administration', 'Switch an account off', {
    desc: 'An account is switched off and never deleted. You cannot switch off your own account.', roles: ['admin'],
    reply: [200, 'The account.', ref('AdminUser')], errors: [400, 404],
  }),
  op('post', '/admin/users/{id}/reactivate', 'Administration', 'Switch an account on again', {
    roles: ['admin'], reply: [200, 'The account.', ref('AdminUser')], errors: [404],
  }),
  op('get', '/admin/emergency-contacts', 'Administration', 'List the urgent numbers with their ids', {
    roles: ['admin'], reply: [200, 'In display order.', arrayOf('EmergencyContactStaff')],
  }),
  op('post', '/admin/emergency-contacts', 'Administration', 'Add an urgent number', {
    roles: ['admin'], body: ref('EmergencyContactInput'), reply: [201, 'The number.', ref('EmergencyContactStaff')], errors: [400],
  }),
  op('put', '/admin/emergency-contacts/{id}', 'Administration', 'Change an urgent number', {
    desc: 'A field left out keeps its value.', roles: ['admin'], body: ref('EmergencyContactInput'),
    reply: [200, 'The number.', ref('EmergencyContactStaff')], errors: [400, 404],
  }),
  op('delete', '/admin/emergency-contacts/{id}', 'Administration', 'Delete an urgent number', {
    desc: 'Deleting the last one is allowed. The public list then shows the built-in numbers.', roles: ['admin'], reply: [204, 'Deleted.'], errors: [404],
  }),
  op('get', '/admin/stats', 'Administration', 'Read the counts', { roles: ['admin'], reply: [200, 'Counts only.', ref('Stats')] }),
];

// ------------------------------------------------------------------------------ the document

const TAGS = [
  ['Server', 'Is it running.'],
  ['Accounts', 'Sign up, sign in, reset a password and manage your own account.'],
  ['Directory', 'The lawyers, consultants and organisations that solve legal problems.'],
  ['Where to go', 'Which body a kind of matter goes to first, with the law, the steps and the deadline.'],
  ['Urgent numbers', 'Numbers for someone in a crisis. This list is never empty.'],
  ['Search', 'One search over guides, routes and directory entries.'],
  ['Guides', 'Legal information in simple words, written and published by an admin.'],
  ['Saved guides', 'Guides a signed-in person keeps.'],
  ['Checklists', 'Which documents a task needs.'],
  ['Consultations', 'Requests for a consultation, in a name or without one.'],
  ['Questions', 'Questions for a legal expert, in a name or without one.'],
  ['Matters', 'A person’s private record of a legal problem, with reminders and sharing.'],
  ['Matter documents', 'Files a person attaches to a matter for a lawyer to check.'],
  ['Administration', 'Invitations, accounts, urgent numbers and counts. Admin only.'],
];

function parameters(o, path) {
  const found = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1], in: 'path', required: true, description: PARAM_NOTES[m[1]],
    schema: m[1] === 'token' ? { type: 'string' } : { type: 'integer' },
  }));
  const asked = (o.query || []).map((p) => ({ name: p.name, in: 'query', required: Boolean(p.required), description: p.description, schema: p.schema }));
  return [...found, ...asked];
}

function build(o) {
  const roles = o.roles;
  const responses = {};
  const [code, description, schema, types] = o.reply;
  if (schema) responses[code] = { description, content: { 'application/json': { schema } } };
  else if (types) responses[code] = { description, content: Object.fromEntries(types.map((t) => [t, { schema: { type: 'string', format: 'binary' } }])) };
  else responses[code] = { description };
  const errors = new Set(o.errors || []);
  if (roles) { errors.add(401); if (roles.join() !== ANYONE_SIGNED_IN.join()) errors.add(403); }
  if (o.limited) errors.add(429);
  for (const e of [...errors].sort()) {
    responses[e] = { description: STATUS_TEXT[e], content: { 'application/json': { schema: ref('Error') } } };
  }
  const operation = {
    tags: [o.tag],
    summary: o.summary,
    ...(o.desc || roles ? { description: [o.desc, roles ? `Who: ${roles.join(', ')}.` : null].filter(Boolean).join('\n\n') } : {}),
    'x-roles': roles || 'public',
    ...(roles ? { security: [{ bearerAuth: [] }] } : {}),
    parameters: parameters(o, o.path),
    responses,
  };
  if (o.body) operation.requestBody = { required: true, content: { 'application/json': { schema: o.body } } };
  if (o.rawBody) {
    operation.requestBody = {
      required: true, description: 'The file itself.',
      content: Object.fromEntries(o.rawBody.map((t) => [t, { schema: { type: 'string', format: 'binary' } }])),
    };
  }
  return operation;
}

const paths = {};
for (const o of OPS) {
  paths[o.path] = paths[o.path] || {};
  paths[o.path][o.method] = build(o);
}

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'ALU Legal Companion API',
    version: '0.1.0',
    description: [
      'A verified directory of the bodies in Rwanda that solve legal problems, where each kind of matter goes first, tracking of a matter with deadline reminders, guides in simple words, anonymous help-seeking and a small assistant.',
      '',
      'Sign in with POST /auth/login. Use "Authorize" and paste the token. Routes marked with a lock need it.',
      'Every error is { "error": "a message a person can act on" }.',
      'Legal information, not legal advice.',
    ].join('\n'),
  },
  servers: [{ url: '/api', description: 'This server' }],
  tags: TAGS.map(([name, description]) => ({ name, description })),
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'The token from sign-in. It works for 7 days or until the account signs out.' },
    },
    schemas,
  },
};

// Every route this file describes, as "METHOD /path". The test compares it with the server.
export const documentedRoutes = OPS.map((o) => `${o.method.toUpperCase()} ${o.path}`);

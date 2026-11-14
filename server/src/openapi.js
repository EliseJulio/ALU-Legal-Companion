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
    pending_email: text('A new address that is waiting for its link to be used. Null when no change is under way.', { nullable: true }),
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

  LadderStep: obj({
    id: whole('The step number.'), position: whole('The order on screen, from 1 to 99.'), title: text(''), tagline: text(''),
    description: text(''), law_cited: text(''),
  }),
  LadderStaff: obj({
    id: whole('The step number.'), position: whole(''), title: text(''), tagline: text(''), description: text(''),
    law_cited: text(''), status: oneOf(['draft', 'published']), updated_at: moment('Last change.'),
  }),
  LadderInput: obj({
    position: whole('A whole number from 1 to 99.'), title: text('At most 120 characters. Required.'),
    tagline: text('At most 120 characters.'), description: text('At most 1000 characters.'),
    law_cited: text('At most 200 characters.'),
  }, ['position', 'title']),
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

  AskAiReply: obj({
    answered: flag('True when a guide answered the question. False when none matches or the guides do not cover it.'),
    answer: text('The answer in plain text. Present only when answered is true.', { nullable: true }),
    sources: arrayOf(obj({ id: whole('The guide number.'), title: text('The guide title.') })),
    message: text('Why there is no answer. Present only when answered is false.', { nullable: true }),
    reason: text('Which step stopped the answer: no_match (no guide found), not_covered (the guides do not hold it) or figure_check (the answer had a figure the guides lack). Present only when answered is false.', { nullable: true }),
  }, ['answered']),

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
    guide_id: whole('The guide this checklist is based on. Shown only while that guide is published.', { nullable: true }), guide_title: text('', { nullable: true }),
  }),
  Checklist: obj({
    id: whole(''), slug: text(''), title: text(''), description: text('', { nullable: true }),
    items: arrayOf('ChecklistItem'), verified_at: moment('When it was published.'),
    guide_id: whole('The guide this checklist is based on. Shown only while that guide is published.', { nullable: true }), guide_title: text('', { nullable: true }),
  }),
  ChecklistStaff: obj({
    id: whole(''), slug: text(''), title: text(''), description: text('', { nullable: true }), items: arrayOf('ChecklistItem'),
    status: oneOf(['draft', 'pending_review', 'published']), verified_at: moment('', { nullable: true }), updated_at: moment(''),
    guide_id: whole('The guide this checklist is based on.', { nullable: true }), guide_title: text('', { nullable: true }),
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
    file: {
      ...obj({ name: text('The name the file had, cleaned.'), size_bytes: whole(''), mime: oneOf(['application/pdf', 'image/png', 'image/jpeg']) }),
      nullable: true, description: 'The file attached to this line, or null. The stored name is never sent.',
    },
  }),
  Reminder: obj({
    id: whole(''), due_on: day('The deadline.'), send_on: day('The day it is sent.'),
    status: oneOf(['pending', 'sent', 'missed', 'cancelled']), sent_at: moment('', { nullable: true }),
  }),
  MatterReminder: obj({
    id: whole(''), matter_id: whole('The matter it belongs to.'), title: text('The matter title. Only the owner reads this.'),
    due_on: day('The deadline.'), send_on: day('The day it is sent.'),
    status: oneOf(['pending', 'sent']), sent_at: moment('', { nullable: true }),
  }),
  MatterProgress: obj({
    id: whole('The matter number.'), title: text(''), next_due: day('The next deadline.'), shared: flag('True while the matter is shared with a lawyer.'),
    checklist: { ...obj({ title: text(''), under_review: flag('True while the checklist is being checked again. No figures are given then.') }), nullable: true },
    needed: whole('Required documents. Left out when there is no published checklist.'), complete: whole('Checked by a lawyer.'),
    awaiting: whole('Uploaded, waiting for a lawyer.'), to_fix: whole('A lawyer asked for a change.'), expired: whole('Out of date.'),
    missing: whole('Not uploaded.'), ready: flag('True when every required document is complete. It is not a promise that an office will accept it.'),
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
    created_at: moment(''), meet_link: text('Only once accepted.', { nullable: true }), requester: text('The name of a signed-in requester, or "Anonymous requester" for an anonymous one. Never any part of a token.'),
  }),
  BookingInput: obj({
    provider_id: whole('A published directory entry that takes bookings.'),
    slot: moment('In the future and within a year.'), topic: text('At most 500 characters.'),
  }, ['provider_id', 'slot']),
  AnonBooking: obj({
    id: whole(''), provider_id: whole(''), slot: moment(''), topic: text('', { nullable: true }), status: oneOf(BOOKING_STATES),
    anon_token: text('Shown once. It cannot be recovered.'), warning: text('A reminder to save the token.'),
  }),
  JoinReply: obj({
    provider: oneOf(['own', 'daily', 'meet', 'none'], 'own: a call held inside the platform. daily: join a Daily room. meet: open the Google Meet link. none: no call is set up.'),
    room: text('Only for own. The private room name.', { nullable: true }),
    role: oneOf(['host', 'guest'], 'Only for own. The lawyer is the host and everyone else is a guest.'),
    ticket: text('Only for own. A signed ticket for one room and one role. It holds no name or email.', { nullable: true }),
    signal_url: text('Only for own. The secure WebSocket address of the signaling service for this room.', { nullable: true }),
    ice_servers: { type: 'array', description: 'Only for own. The STUN and relay servers the browser uses to find a route. The relay credentials last four hours.', items: { type: 'object' } },
    url: text('The room address (daily) or the Meet link (meet).', { nullable: true }),
    token: text('Only for daily. The person\'s own token for the room.', { nullable: true }),
    audioOnlyAllowed: flag('Only for daily. Always true.'),
    reason: text('Why the call is not in the platform: daily_unavailable, daily_failed or daily_cap.', { nullable: true }),
    message: text('Only for none. What to tell the person.', { nullable: true }),
  }, ['provider']),
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
    overdue: flag('True once the question has waited longer than the answer target.'),
  }),

  ReportSent: obj({
    id: whole('The report number.'),
    code: text('Only for a report sent without an email address. Shown once. For example LC-4F9K27QX. It is the only way to see the answer.'),
    warning: text('A reminder to save the code.'),
  }),
  ReportStatus: obj({
    type: oneOf(['info', 'office', 'broken', 'safety', 'idea'], 'What the report is about.'),
    about_label: text('The page the sender was looking at.', { nullable: true }),
    status: oneOf(['received', 'in_progress', 'resolved'], 'Where the report is.'),
    created_at: moment('When it was sent.'), read_at: moment('When the admin first opened it.', { nullable: true }),
    resolved_at: moment('When it was resolved.', { nullable: true }), admin_reply: text('The reply from the admin.', { nullable: true }),
  }),
  ReportRow: obj({
    id: whole('The report number.'), type: oneOf(['info', 'office', 'broken', 'safety', 'idea']),
    about_kind: { type: 'string', nullable: true, enum: ['guide', 'route', 'provider', 'page', null], description: 'What the sender was looking at.' },
    about_id: whole('', { nullable: true }), about_label: text('', { nullable: true }), status: oneOf(['received', 'in_progress', 'resolved']),
    reply_channel: oneOf(['code', 'email'], 'How the sender is answered.'), excerpt: text('The first 160 characters of the message.'),
    read_at: moment('', { nullable: true }), resolved_at: moment('', { nullable: true }), created_at: moment(''),
  }),
  ReportList: obj({
    reports: arrayOf('ReportRow'),
    counts: obj({
      received: whole(''), in_progress: whole(''), resolved: whole(''),
      resolved_this_month: whole(''), unresolved_safety: whole('Safety concerns not yet resolved.'),
    }),
  }),
  ReportDetail: obj({
    id: whole(''), type: oneOf(['info', 'office', 'broken', 'safety', 'idea']),
    about_kind: { type: 'string', nullable: true, enum: ['guide', 'route', 'provider', 'page', null] }, about_id: whole('', { nullable: true }),
    about_label: text('', { nullable: true }), about_exists: flag('True when the guide, route or entry still exists.'),
    message: text('What the sender wrote.'), status: oneOf(['received', 'in_progress', 'resolved']),
    reply_channel: oneOf(['code', 'email']), contact_email: text('Only until the reply has been sent. Then null.', { nullable: true }),
    admin_reply: text('', { nullable: true }), read_at: moment(''), resolved_at: moment('', { nullable: true }),
    created_at: moment(''), updated_at: moment(''),
  }),
  ReportSaved: obj({
    id: whole(''), type: oneOf(['info', 'office', 'broken', 'safety', 'idea']),
    status: oneOf(['received', 'in_progress', 'resolved']), reply_channel: oneOf(['code', 'email']),
    admin_reply: text('', { nullable: true }), read_at: moment(''), resolved_at: moment('', { nullable: true }), updated_at: moment(''),
    has_email: flag('True while the address of the sender is still held.'),
    delivery: oneOf(['sent', 'failed'], 'Only when an email report was resolved. "failed" keeps the address so the admin can save again.'),
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
  WeekCount: obj({
    week_start: day('The Monday of the week (UTC). The week runs Monday to Sunday.'),
    questions: whole('Questions asked in the week.'), bookings: whole('Consultations requested in the week.'),
  }),
  AdminBooking: obj({
    id: whole('The booking number.'), provider_id: whole('The directory entry.'), provider_name: text('The office or person.'),
    slot: moment('The time asked for.'), status: oneOf(BOOKING_STATES),
  }),
  QuestionSummary: obj({
    open: whole('Open questions waiting for any lawyer.'),
    overdue: whole('Open questions older than answer_target_days.'),
    answer_target_days: whole('A question left open longer than this many days is overdue.'),
    answered_this_month: whole('Questions this lawyer answered this calendar month (UTC).'),
    average_wait_days: { type: 'number', description: 'Average days from asked to answered for those answers, one decimal. Left out when there are none.' },
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
      questions: obj({ total: whole(''), anonymous: whole(''), open: whole(''), overdue: whole('Open questions older than answer_target_days.') }),
      weekly: arrayOf(ref('WeekCount')),
      answer_target_days: whole('A question left open longer than this many days is overdue.'),
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
  op('get', '/auth/mail-status', 'Accounts', 'Say whether this server can send email', {
    desc: 'The sign-up page asks this before it shows the form. It gives one answer and nothing about the mail setup.',
    reply: [200, 'Whether email can be sent.', obj({ available: flag('False only in production with no mail service set up.') }, ['available'])],
    limited: true,
  }),
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
  op('delete', '/auth/me', 'Accounts', 'Erase my account', {
    desc: 'Students and staff only. Deletes the account, its matters with their stored files, saved guides, sign-in tokens and questions. A booking stays for the provider with no link to the person and no topic. Lawyers and admins get 403 and ask an admin. 401 for a wrong password.',
    roles: OWNERS, limited: true, errors: [400, 401, 403, 500],
    body: obj({ password: text('The password now.'), confirm: flag('Must be true.') }, ['password', 'confirm']),
    reply: [200, 'Erased. The old token stops working.', obj({ ok: flag('Always true.') })],
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
  op('post', '/auth/change-email', 'Accounts', 'Ask to change my email address', {
    desc: 'Needs the current password. Nothing changes yet. The new address waits until the link sent to it is used, so a typo cannot lock anyone out. Students and staff must use an ALU address. The answer is the same for every address that passes the checks, so it never shows which addresses have an account.',
    roles: ANYONE_SIGNED_IN, limited: true, errors: [400],
    body: obj({ email: text('The new address.'), current_password: text('The password now.') }, ['email', 'current_password']),
    reply: [200, 'The same message for every address.', ref('Message')],
  }),
  op('post', '/auth/confirm-email-change', 'Accounts', 'Use the emailed link to confirm the new address', {
    desc: 'Works from any device. Switches the address, ends every older session and signs the person in again.',
    body: obj({ token: text('The token from the link.') }, ['token']),
    reply: [200, 'Changed and signed in.', ref('Session')], errors: [400], limited: true,
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

  // ---- Dispute ladder
  op('get', '/directory/ladder', 'Where to go', 'The dispute ladder, in order', {
    desc: 'Published steps only. An empty list means no step is published yet, so nothing is shown.',
    reply: [200, 'The published steps.', arrayOf('LadderStep')],
  }),
  op('get', '/directory/ladder/all', 'Where to go', 'List every ladder step in every state', {
    roles: ['admin'], reply: [200, 'All steps.', arrayOf('LadderStaff')],
  }),
  op('post', '/directory/ladder', 'Where to go', 'Add a ladder step as a draft', {
    roles: ['admin'], body: ref('LadderInput'), reply: [201, 'The new draft.', ref('LadderStaff')], errors: [400],
  }),
  op('put', '/directory/ladder/{id}', 'Where to go', 'Change a ladder step', {
    desc: 'A field left out keeps its value. Any edit sends the step back to draft.', roles: ['admin'],
    body: ref('LadderInput'), reply: [200, 'The step after the change.', ref('LadderStaff')], errors: [400, 404],
  }),
  op('post', '/directory/ladder/{id}/publish', 'Where to go', 'Publish a ladder step', {
    roles: ['admin'], reply: [200, 'Published.', obj({ id: whole(''), status: text('"published".') })], errors: [400],
  }),
  op('delete', '/directory/ladder/{id}', 'Where to go', 'Remove a ladder step', {
    roles: ['admin'], reply: [200, 'Removed.', obj({ id: whole('') })], errors: [404],
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

  // ---- Ask AI
  op('get', '/ask-ai/status', 'Ask AI', 'Is Ask AI set up on this server', {
    desc: 'Says only whether Ask AI can answer. Nothing else about the setup is shown.',
    reply: [200, 'The setup.', obj({ available: flag('True when the key and the model are set.') }, ['available'])],
  }),
  op('post', '/ask-ai', 'Ask AI', 'Ask a question answered from the published guides', {
    desc: 'The answer is written by a Google Gemini model from the guides that match the question, and it may be wrong. Nothing about the asker or the question is stored. A question with no matching guide is answered without calling the model.',
    body: obj({ question: text('5 to 500 characters.') }, ['question']),
    reply: [200, 'The answer, or the reason there is none.', ref('AskAiReply')], errors: [400, 503], limited: true,
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
    desc: 'An anonymous requester is always shown as "Anonymous requester". No part of the token is ever sent. Act on a request by its id.', roles: ['legal_expert'], reply: [200, 'Soonest first.', arrayOf('BookingExpert')],
  }),
  op('post', '/bookings/{id}/status', 'Consultations', 'Accept, decline or complete a request', {
    desc: 'A request moves forward only. Accepting emails the person if they signed in.',
    roles: ['legal_expert'], body: obj({ status: oneOf(['accepted', 'declined', 'completed'], 'The new state.') }, ['status']),
    reply: [200, 'The request after the change.', ref('Booking')], errors: [400, 404, 409],
  }),
  op('post', '/bookings/{id}/join', 'Consultations', 'Get the call for an accepted booking', {
    desc: 'For the signed-in owner, the lawyer, or the anonymous booker with the code in the body. Anyone else gets 404. The first join makes the private video room, and later joins reuse it. If the call cannot start in the platform, the answer is the lawyer\'s Google Meet link instead, with the reason. The Meet link is never given for a request that is not accepted.',
    body: obj({
      anon_token: text('The anonymous booking code. Only for the anonymous booker.'),
      audio_only: flag('Start with the camera off.'),
    }),
    reply: [200, 'The call, or the fallback.', ref('JoinReply')], errors: [404, 409], limited: true,
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
  op('get', '/questions/summary', 'Questions', 'My answering figures', {
    desc: 'Counts and one average. Only the answers this lawyer gave. Answers given before the time was recorded are not counted.',
    roles: ['legal_expert'], reply: [200, 'The figures.', ref('QuestionSummary')],
  }),
  op('post', '/questions/{id}/answer', 'Questions', 'Answer a question', {
    roles: ['legal_expert'], body: obj({ answer: text('At most 10000 characters.') }, ['answer']),
    reply: [200, 'Answered.', obj({ id: whole(''), status: text('"answered".') })], errors: [400, 404],
  }),

  // ---- Reports
  op('post', '/reports', 'Reports', 'Report a problem', {
    desc: 'Stores no account and no IP address. With reply_by "code" the reply holds a code, shown once. With reply_by "email" the address is kept only until the reply of the admin is sent.',
    body: obj({
      type: oneOf(['info', 'office', 'broken', 'safety', 'idea'], 'What the report is about.'),
      message: text('10 to 2000 characters.'),
      about_kind: oneOf(['guide', 'route', 'provider', 'page'], 'Optional. What the sender was looking at.'),
      about_id: whole('Needed for a guide, route or provider.'), about_label: text('The page title. At most 200 characters.'),
      reply_by: oneOf(['code', 'email'], 'How the sender wants to be reached.'),
      email: text('Only with reply_by "email".'),
    }, ['type', 'message', 'reply_by']),
    reply: [201, 'The report number and, for a code-only report, the code.', ref('ReportSent')], errors: [400], limited: true,
  }),
  op('post', '/reports/check', 'Reports', 'See where a report is with its code', {
    desc: 'A POST so the code is never in a URL. A wrong code gets the same answer as any other unknown code.',
    body: obj({ code: text('The code shown when the report was sent, for example LC-4F9K27QX. Case, spaces and hyphens do not matter.') }, ['code']),
    reply: [200, 'Where the report is.', ref('ReportStatus')], errors: [404], limited: true,
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
  op('get', '/matters/reminders', 'Matters', 'List the reminders of my open matters', {
    desc: 'Waiting and sent reminders for deadlines no more than two weeks past. Newest send date first.',
    roles: OWNERS, reply: [200, 'Up to 20 reminders.', arrayOf('MatterReminder')],
  }),
  op('get', '/matters/progress', 'Matters', 'Where the documents of each open matter stand', {
    desc: 'Counts of required documents by what a lawyer has said. A matter with no published checklist carries no figures.',
    roles: OWNERS, reply: [200, 'Soonest deadline first.', arrayOf('MatterProgress')],
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
    desc: 'The owner. The lawyer too, while the matter is shared. Send JSON, or multipart/form-data when the owner attaches one file (field "file": a PDF, PNG or JPEG of at most 5 MB, read by its bytes). The line and its file are made together or not at all. A lawyer’s note carries no file. With no document key on the server a file is refused with 503 and no line is made.',
    roles: [...OWNERS, 'legal_expert'], limited: true,
    body: obj({ description: text('At most 2000 characters.'), occurred_on: day('Not in the future. Defaults to today in Kigali.') }, ['description']),
    multipart: obj({ description: text('At most 2000 characters.'), occurred_on: day('Not in the future. Defaults to today in Kigali.'), file: { type: 'string', format: 'binary', description: 'The optional file.' } }, ['description']),
    reply: [201, 'The line, with its file when it has one.', ref('MatterEvent')], errors: [400, 404, 503],
  }),
  op('get', '/matters/{id}/events/{eventId}/file', 'Matters', 'Download the file on a line of the record', {
    desc: 'The owner, or the legal expert the matter is shared with at this moment. Anyone else, an admin too, gets 404.',
    roles: ANYONE_SIGNED_IN,
    reply: [200, 'The file as it was attached.', null, ['application/pdf', 'image/png', 'image/jpeg']], errors: [404],
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
  op('get', '/admin/bookings', 'Administration', 'List every consultation, view only', {
    desc: 'The office, the time and the state. Never who asked: no name, account, token or topic. Optional from and to (YYYY-MM-DD, both included) limit it by time, in UTC. Soonest first.',
    roles: ['admin'], reply: [200, 'The consultations.', arrayOf('AdminBooking')], errors: [400],
  }),
  op('get', '/admin/reports', 'Administration', 'List the reports', {
    desc: 'Unresolved safety concerns come first, then the newest. The code hash is never sent.',
    roles: ['admin'], query: [
      { name: 'status', schema: oneOf(['received', 'in_progress', 'resolved']), description: 'Keep one status.' },
      { name: 'type', schema: oneOf(['info', 'office', 'broken', 'safety', 'idea']), description: 'Keep one type.' },
    ],
    reply: [200, 'The reports and the counts.', ref('ReportList')], errors: [400],
  }),
  op('get', '/admin/reports/export', 'Administration', 'Download the reports as a CSV file', {
    desc: 'Takes the same filters as the list. UTF-8 with a BOM. Columns: id, type, about_kind, about_label, status, reply_channel, created_at, read_at, resolved_at, message, admin_reply. Never the code hash or an email address. A cell that could run as a formula starts with a quote.',
    roles: ['admin'],
    query: [
      { name: 'status', schema: oneOf(['received', 'in_progress', 'resolved']), description: 'Keep one status.' },
      { name: 'type', schema: oneOf(['info', 'office', 'broken', 'safety', 'idea']), description: 'Keep one type.' },
    ],
    reply: [200, 'The file.', null, ['text/csv']], errors: [400],
  }),
  op('get', '/admin/reports/{id}', 'Administration', 'Read one report', {
    desc: 'Opening a report marks it read.', roles: ['admin'], reply: [200, 'The report.', ref('ReportDetail')], errors: [404],
  }),
  op('put', '/admin/reports/{id}', 'Administration', 'Set the status of a report and reply', {
    desc: 'Resolving an email report sends one email with the reply and then erases the address. If the send fails the address stays and delivery is "failed".',
    roles: ['admin'], body: obj({ status: oneOf(['received', 'in_progress', 'resolved']), admin_reply: text('At most 1000 characters.') }, ['status']),
    reply: [200, 'The report after the change.', ref('ReportSaved')], errors: [400, 404],
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
  ['Ask AI', 'A short answer written by a model from the published guides. Anyone may ask.'],
  ['Guides', 'Legal information in simple words, written and published by an admin.'],
  ['Saved guides', 'Guides a signed-in person keeps.'],
  ['Checklists', 'Which documents a task needs.'],
  ['Consultations', 'Requests for a consultation, in a name or without one.'],
  ['Questions', 'Questions for a legal expert, in a name or without one.'],
  ['Reports', 'Reports of a problem on the site, with or without a name.'],
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
  if (o.body) {
    operation.requestBody = { required: true, content: { 'application/json': { schema: o.body } } };
    if (o.multipart) operation.requestBody.content['multipart/form-data'] = { schema: o.multipart };
  }
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
      'A verified directory of the bodies in Rwanda that solve legal problems, where each kind of matter goes first, tracking of a matter with deadline reminders, guides in simple words, document checklists, documents a lawyer can check, and anonymous questions and bookings.',
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

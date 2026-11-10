import { canOwnActivity, hasRole } from '@/lib/auth';

// Every destination of the shell. Each `to` is a page in App.jsx. `icon` is a name in lib/icons.js.
// `quick` puts a link in the phone bottom bar (four at most). `short` is the word under its icon
// there. A visitor's bottom bar shows all four public links whatever their flags say.
//

// The links anyone can use. A visitor sees them all. Signed in people see them too.
// The Directory holds the guided questions, so it takes the first place on the phone bar.
export const PUBLIC_LINKS = [
  { to: '/directory', label: 'Directory', icon: 'contacts', quick: true, short: 'Directory' },
  { to: '/guides', label: 'Legal guides', icon: 'menu_book', short: 'Guides' },
  { to: '/ask', label: 'Ask a legal expert', icon: 'chat_bubble', short: 'Ask' },
  // A legal expert does not see this link. The footer reads hideFor, so the rule is in one place.
  { to: '/ask-ai', label: 'Ask AI', icon: 'sparkles', short: 'Ask AI', hideFor: ['legal_expert'] },
];

// A student or a staff member.
// Home is the first link of a student's workspace. It is not on the phone bar.
const MEMBER_LINKS = [
  { to: '/home', label: 'Home', icon: 'home', end: true, short: 'Home' },
  { to: '/matters', label: 'My matters', icon: 'folder', quick: true, short: 'Matters' },
  { to: '/appointments', label: 'Appointments', icon: 'calendar_clock', short: 'Appointments' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar_month', quick: true, short: 'Calendar' },
  { to: '/saved', label: 'Saved resources', icon: 'bookmark', quick: true, short: 'Saved' },
  { to: '/my-activity', label: 'My activity', icon: 'schedule' },
];

// `end` makes a link current only on its own page. Without it a screen reader hears two current
// pages. A legal expert answers questions, keeps the calendar of consultations and reads matters
// shared with them. The calendar is the same page name for every role.
const EXPERT_LINKS = [
  { to: '/expert', label: 'Overview', icon: 'dashboard', end: true, quick: true, short: 'Overview' },
  { to: '/expert/questions', label: 'Questions', icon: 'chat_bubble', end: true, quick: true, short: 'Questions' },
  { to: '/expert/calendar', label: 'Calendar', icon: 'calendar_month', quick: true, short: 'Calendar' },
  { to: '/expert/matters', label: 'Shared matters', icon: 'group', quick: true, short: 'Shared' },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Overview', icon: 'dashboard', end: true, quick: true, short: 'Overview' },
  { to: '/admin/calendar', label: 'Calendar', icon: 'calendar_month', short: 'Calendar' },
  { to: '/admin/guides', label: 'Guides', icon: 'menu_book', quick: true, short: 'Guides' },
  { to: '/admin/providers', label: 'Directory entries', icon: 'folder', quick: true, short: 'Directory' },
  { to: '/admin/routes', label: 'Routes', icon: 'route', quick: true, short: 'Routes' },
  { to: '/admin/reports', label: 'Reports', icon: 'inbox' },
  { to: '/admin/checklists', label: 'Checklists', icon: 'checklist' },
  { to: '/admin/users', label: 'People', icon: 'group' },
  { to: '/admin/invites', label: 'Invitations', icon: 'mail' },
  { to: '/admin/contacts', label: 'Urgent contacts', icon: 'call' },
];

// Every signed in person has one account page.
export const ACCOUNT_LINK = { to: '/settings', label: 'Account', icon: 'person' };

// Anyone can report a problem. Signed in people find it in their Account group.
export const REPORT_LINK = { to: '/report', label: 'Report a problem', icon: 'flag' };

// What a visitor finds under More. Signed in people have Account and sign out instead.
export const VISITOR_MORE = [
  { to: '/login', label: 'Sign in', icon: 'login' },
  { to: '/register', label: 'Create account', icon: 'person' },
  REPORT_LINK,
  { to: '/emergency', label: 'Emergency numbers', icon: 'warning' },
];

// The workspace of a signed in person. It is null for a visitor and for a person with no role.
function workspaceFor(user) {
  if (canOwnActivity(user)) return { title: 'Your workspace', links: MEMBER_LINKS };
  if (hasRole(user, ['legal_expert'])) return { title: 'Expert workspace', links: EXPERT_LINKS };
  if (hasRole(user, ['admin'])) return { title: 'Admin workspace', links: ADMIN_LINKS };
  return null;
}

// The groups of the menu for this person, in order. An admin and a legal expert get no public group:
// the public pages stay open to them by search and the address bar. "Ask a legal expert" is the
// lawyer's own job, so showing it to them as a visitor action is clutter.
export function navGroups(user) {
  const groups = [];
  if (!user) return [{ title: 'Explore', links: PUBLIC_LINKS }];
  if (!hasRole(user, ['admin', 'legal_expert'])) groups.push({ title: 'Explore', links: PUBLIC_LINKS });
  const work = workspaceFor(user);
  if (work) groups.push(work);
  groups.push({ title: 'Account', links: [ACCOUNT_LINK, REPORT_LINK] });
  return groups;
}

// The groups of the More sheet. A visitor also finds sign in and the emergency numbers there.
export function sheetGroups(user) {
  if (user) return navGroups(user);
  return [...navGroups(null), { title: 'More', links: VISITOR_MORE }];
}

// The links in the phone bottom bar. At most four, in the order of the menu. A student's bar can
// hold public pages (the flags on those links say which). A lawyer's and an admin's bar holds
// their workspace only.
export function quickLinks(user) {
  if (!user) return PUBLIC_LINKS;
  return navGroups(user)
    .filter((group) => group.title !== 'Account')
    .filter((group) => canOwnActivity(user) || group.title !== 'Explore')
    .flatMap((group) => group.links)
    .filter((link) => link.quick)
    .slice(0, 4);
}

// The role of a signed in person, as the menu shows it.
export function roleName(user) {
  if (hasRole(user, ['student'])) return 'Student';
  if (hasRole(user, ['staff'])) return 'Staff';
  if (hasRole(user, ['legal_expert'])) return 'Legal expert';
  if (hasRole(user, ['admin'])) return 'Administrator';
  return 'Visitor';
}

// Where a signed in person starts: each role's own overview.
export function homeFor(user) {
  if (canOwnActivity(user)) return '/home';
  if (hasRole(user, ['legal_expert'])) return '/expert';
  if (hasRole(user, ['admin'])) return '/admin';
  return '/';
}

import { canOwnActivity, hasRole } from '@/lib/auth';

// The links anyone can use. They are always the first group in the side navigation.
// `icon` is the name of a glyph in the icon font.
export const PUBLIC_LINKS = [
  { to: '/where-to-go', label: 'Where to Go', icon: 'signpost' },
  { to: '/directory', label: 'Directory', icon: 'contacts' },
  { to: '/guides', label: 'Legal Guides', icon: 'menu_book' },
  { to: '/ask', label: 'Ask a legal expert', icon: 'chat_bubble' },
];

// A student or a staff member.
const MEMBER_LINKS = [
  { to: '/matters', label: 'My Matters', icon: 'folder' },
  { to: '/saved', label: 'Saved Resources', icon: 'bookmark' },
  { to: '/my-activity', label: 'My Activity', icon: 'schedule' },
];

// `end` makes /admin current only on its own page. Without it a screen reader hears two current
// pages. A legal expert gives consultations, appointments and reads matters shared with them.
const EXPERT_LINKS = [
  { to: '/expert/questions', label: 'Questions', icon: 'chat_bubble', end: true },
  { to: '/expert/bookings', label: 'Appointments', icon: 'calendar_month' },
  { to: '/expert/matters', label: 'Shared matters', icon: 'group' },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Overview', icon: 'dashboard', end: true },
  { to: '/admin/guides', label: 'Guides', icon: 'menu_book' },
  { to: '/admin/providers', label: 'Directory entries', icon: 'folder' },
  { to: '/admin/routes', label: 'Routes', icon: 'route' },
  { to: '/admin/checklists', label: 'Checklists', icon: 'checklist' },
  { to: '/admin/users', label: 'People', icon: 'group' },
  { to: '/admin/invites', label: 'Invitations', icon: 'mail' },
  { to: '/admin/contacts', label: 'Urgent contacts', icon: 'call' },
];

// Every signed in person has one account page.
export const ACCOUNT_LINK = { to: '/settings', label: 'Account', icon: 'person' };

// The groups of the side navigation for this person. A visitor sees only the public group.
// Each role sees its own workspace and never the pages of another role.
export function navGroups(user) {
  const groups = [{ title: 'Explore', links: PUBLIC_LINKS }];
  if (canOwnActivity(user)) groups.push({ title: 'Your workspace', links: MEMBER_LINKS });
  else if (hasRole(user, ['legal_expert'])) groups.push({ title: 'Expert workspace', links: EXPERT_LINKS });
  else if (hasRole(user, ['admin'])) groups.push({ title: 'Admin workspace', links: ADMIN_LINKS });
  return groups;
}

// Where a signed in person starts.
export function homeFor(user) {
  if (canOwnActivity(user)) return '/matters';
  if (hasRole(user, ['legal_expert'])) return '/expert/questions';
  if (hasRole(user, ['admin'])) return '/admin';
  return '/';
}

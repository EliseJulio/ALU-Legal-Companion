import { pillClass, statusToneFor } from '@/lib/ui';

// A status as a word in a pill. What it means is in the text and never in the colour alone.
// The pill reads the same in greyscale and to a screen reader. The stored code is never shown.
// A reader sees "Open" and not a database value. The words live here so two pages cannot call
// the same state by two names. New states are added to this list.
const PHRASES = {
  // matters
  open: 'Open',
  closed: 'Finished',
  // guides, directory entries and routes
  // The admin writes and publishes. There is no review state to show, so a pending_review
  // row reads as a draft.
  draft: 'Draft',
  pending_review: 'Draft',
  published: 'Published',
  withdrawn: 'Withdrawn',
  // accounts
  active: 'Active',
  deactivated: 'Switched off',
  unverified: 'Email not confirmed',
  // invitations
  pending: 'Waiting',
  used: 'Used',
  expired: 'Expired',
  // anonymous questions
  answered: 'Answered',
  awaiting_response: 'Awaiting response',
  // bookings
  requested: 'Requested',
  accepted: 'Accepted',
  declined: 'Declined',
  completed: 'Completed',
  // reports of a problem
  received: 'Received',
  in_progress: 'In progress',
  resolved: 'Resolved',
  // documents on a matter. The plain word pending is already used for invitations.
  missing: 'Missing',
  awaiting_check: 'Awaiting check',
  complete: 'Complete',
  needs_fix: 'Needs fixing',
  out_of_date: 'Out of date',
};

export default function StatusPill({ status }) {
  // Nothing at all is better than an empty pill. It would look like a value that failed to load.
  if (!status) return null;
  // An unknown status is shown as it is. That is clumsy but better than a blank or a crash.
  const key = String(status).toLowerCase();
  const phrase = Object.hasOwn(PHRASES, key) ? PHRASES[key] : status;

  // The tone comes from the one shared list in lib/ui.js: soft blue for a state that is under way or
  // done, grey for the rest. The word carries the meaning either way.

  return (
    <span className={pillClass(statusToneFor(status))}>
      <span className="sr-only">Status: </span>{phrase}
    </span>
  );
}

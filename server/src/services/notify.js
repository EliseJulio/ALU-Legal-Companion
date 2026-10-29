// Email that tells a person something changed and where to look.
//   an appointment is accepted      -> the signed-in person gets the time and the meeting link
//   a shared document changes       -> the lawyer it is shared with is told to look
//   the lawyer comments or checks   -> the owner is told to look
//
// An email says that something changed and where to look. It never carries the text of a comment,
// the name of a document, the title of a matter or who the owner is. Those are the person's own
// words and a mailbox is less private than this site. The meeting link is the one detail a person
// asked to receive, and a booking with no account has no address, so it gets nothing.
//
// A failed send never breaks the request that caused it. It is logged without the address and the
// person still sees the change on the site.
import { q } from '../db.js';
import { sendMail, appUrl } from './mailer.js';

const pending = new Set();

// Runs a send in the background. The route does not wait for the mail server.
function fire(task) {
  const run = Promise.resolve()
    .then(task)
    .catch((err) => console.error('[notify] send failed', { error: err.code || err.name }))
    .finally(() => pending.delete(run));
  pending.add(run);
  return run;
}

// For tests. It resolves once every send started so far has finished.
export const whenSettled = () => Promise.allSettled([...pending]);

// A burst of uploads must not send the lawyer one email for each file. One email says look, and a
// second one within a few minutes would add nothing.
const QUIET_MS = 5 * 60 * 1000;
const lastTold = new Map();
export const resetNotifyThrottle = () => lastTold.clear();
function quiet(key) {
  const last = lastTold.get(key);
  if (last && Date.now() - last < QUIET_MS) return true;
  lastTold.set(key, Date.now());
  return false;
}

const when = (iso) => new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Africa/Kigali', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// A person with a switched-off account gets nothing.
const ownerOf = async (matterId) => (await q(
  `SELECT u.email FROM matters m JOIN users u ON u.id = m.user_id
    WHERE m.id = $1 AND u.deactivated_at IS NULL`, [matterId]))[0];

// The lawyer the matter is shared with at this moment. Nobody if it is not shared.
const lawyerOf = async (matterId) => (await q(
  `SELECT u.email FROM matters m
     JOIN providers p ON p.id = m.shared_with
     JOIN users u ON u.id = p.user_id
    WHERE m.id = $1 AND u.deactivated_at IS NULL`, [matterId]))[0];

const matterLink = (matterId) => `${appUrl()}/matters/${matterId}`;

// The lawyer accepted a consultation. Only a signed-in person has an address to write to.
export function bookingAccepted(bookingId) {
  return fire(async () => {
    const [b] = await q(
      `SELECT b.slot, u.email, p.name AS provider_name, p.meet_link
         FROM bookings b
         JOIN providers p ON p.id = b.provider_id
         JOIN users u ON u.id = b.user_id AND u.deactivated_at IS NULL
        WHERE b.id = $1 AND b.status = 'accepted'`, [bookingId]);
    if (!b) return;
    const room = b.meet_link
      ? `Meeting link: ${b.meet_link}\nWhen you join, wait to be admitted. The lawyer lets people in one at a time.`
      : 'The lawyer has not added a meeting link yet. Check your activity page again shortly.';
    await sendMail({
      to: b.email,
      subject: 'Your consultation was accepted',
      text: [
        `${b.provider_name} accepted your consultation request.`,
        '',
        `When: ${when(b.slot)} (Kigali time)`,
        room,
        '',
        `Your requests: ${appUrl()}/my-activity`,
      ].join('\n'),
    });
  });
}

// The owner added, replaced or removed a document on a matter that is shared. The lawyer is told to
// look. Nothing says which document or whose matter it is.
export function documentChanged(matterId) {
  return fire(async () => {
    const lawyer = await lawyerOf(matterId);
    if (!lawyer || quiet(`docs:${matterId}`)) return;
    await sendMail({
      to: lawyer.email,
      subject: 'A document on a shared matter changed',
      text: [
        'A document on a matter that is shared with you was added, replaced or removed.',
        'Please take a look when you can.',
        '',
        matterLink(matterId),
      ].join('\n'),
    });
  });
}

// The lawyer commented on a document or recorded a verdict. The owner is told to look.
export function lawyerRespondedOnDocument(matterId, kind) {
  return fire(async () => {
    const owner = await ownerOf(matterId);
    if (!owner) return;
    const comment = kind === 'comment';
    await sendMail({
      to: owner.email,
      subject: comment ? 'Your lawyer commented on a document' : 'Your lawyer checked a document',
      text: [
        comment
          ? 'The lawyer you shared a matter with added a comment on one of your documents.'
          : 'The lawyer you shared a matter with checked one of your documents.',
        'Sign in to read it.',
        '',
        matterLink(matterId),
      ].join('\n'),
    });
  });
}

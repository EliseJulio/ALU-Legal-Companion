// Email that tells a person something changed and where to look.
//   a request is made               -> the lawyer is told a request is waiting, with the time (stops at the budget)
//   an appointment is accepted      -> the signed-in person gets the time and the meeting link
//   a request is declined           -> the signed-in person is told, with a link to ask for another time (stops at the budget)
//   a person cancels or moves it    -> the lawyer is told the time (a move and a cancel both stop at the budget)
//   the lawyer suggests a time      -> the signed-in person is told the suggested time
//   the person answers a suggestion -> the lawyer is told whether the suggested time was taken
//   a shared document changes       -> the lawyer it is shared with is told to look
//   the lawyer comments or checks   -> the owner is told to look
//
// An email says that something changed and where to look. It never carries the text of a comment,
// the name of a document, the title of a matter or who the owner is. Those are the person's own
// words and a mailbox is less private than this site. The meeting link is the only detail sent.
// A booking with no account has no address, so it gets nothing.
//
// A failed send never breaks the request that caused it. It is logged without the address and the
// person still sees the change on the site.
import { q } from '../db.js';
import { sendMail, appUrl } from './mailer.js';
import { EMAIL_BUDGET_CODE } from './emailBudget.js';
import { kigaliDateTime } from './kigali.js';

const pending = new Set();

// Runs a send in the background. The route does not wait for the mail server.
function fire(task) {
  const run = Promise.resolve()
    .then(task)
    .catch((err) => {
      // An optional email skipped because the daily budget is used up. Nothing else is logged.
      if (err.code === EMAIL_BUDGET_CODE) {
        console.log('[notify] skipped: daily email budget reached');
        return;
      }
      console.error('[notify] send failed', { error: err.code || err.name });
    })
    .finally(() => pending.delete(run));
  pending.add(run);
  return run;
}

// For tests. It resolves once every send started so far has finished.
export const whenSettled = () => Promise.allSettled([...pending]);

// A burst of uploads must not send the lawyer one email for each file.
// One email says look. A second one within a few minutes would add nothing.
const QUIET_MS = 5 * 60 * 1000;
const lastTold = new Map();
export const resetNotifyThrottle = () => lastTold.clear();
function quiet(key) {
  const now = Date.now();
  const last = lastTold.get(key);
  if (last && now - last < QUIET_MS) return true;
  // Entries older than the quiet window no longer matter, so they are dropped to keep the map small.
  for (const [k, at] of lastTold) if (now - at >= QUIET_MS) lastTold.delete(k);
  lastTold.set(key, now);
  return false;
}

const when = kigaliDateTime;

// A person with a switched-off account gets nothing.
const ownerOf = async (matterId) => (await q(
  `SELECT u.email FROM matters m JOIN users u ON u.id = m.user_id
    WHERE m.id = $1 AND u.deactivated_at IS NULL`, [matterId]))[0];

// The lawyer the matter is shared with at this moment. Nobody if it is not shared.
const lawyerOf = async (matterId) => (await q(
  `SELECT u.email FROM matters m
     JOIN providers p ON p.id = m.shared_with AND p.status = 'published'
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
      optional: true,
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
      optional: true,
    });
  });
}

// A consultation was requested. The lawyer is told a request is waiting and where to answer it.
// Optional mail: it stops at the daily budget, and the lawyer still sees the request on the appointments
// page. It never says who asked or whether the request is anonymous.
export function newRequest(bookingId) {
  return fire(async () => {
    const [b] = await q(
      `SELECT b.slot, u.email FROM bookings b
         JOIN providers p ON p.id = b.provider_id
         JOIN users u ON u.id = p.user_id AND u.deactivated_at IS NULL
        WHERE b.id = $1`, [bookingId]);
    if (!b) return;
    await sendMail({
      to: b.email,
      subject: 'A consultation was requested',
      text: [
        `A request for a consultation is waiting for you, at ${when(b.slot)} (Kigali time).`,
        '',
        `Accept or decline it on your appointments page: ${appUrl()}/expert/appointments`,
      ].join('\n'),
      optional: true,
    });
  });
}

// The lawyer declined a request or an accepted consultation. The owner is told the time and where to
// ask for another. The lawyer's personal name and the topic are never sent.
export function bookingDeclined(bookingId) {
  return fire(async () => {
    const [b] = await q(
      `SELECT b.slot, u.email, p.name AS provider_name
         FROM bookings b
         JOIN providers p ON p.id = b.provider_id
         JOIN users u ON u.id = b.user_id AND u.deactivated_at IS NULL
        WHERE b.id = $1 AND b.status = 'declined'`, [bookingId]);
    if (!b) return;
    await sendMail({
      to: b.email,
      subject: 'Your consultation request was declined',
      text: [
        `${b.provider_name} could not take the time you asked for.`,
        '',
        `Requested time: ${when(b.slot)} (Kigali time)`,
        '',
        `You can ask for another time: ${appUrl()}/directory`,
      ].join('\n'),
      optional: true,
    });
  });
}

// An accepted consultation was cancelled by the person who booked it. The lawyer gets the time only,
// as optional mail.
export function bookingCancelled(bookingId) {
  return fire(async () => {
    const [b] = await q(
      `SELECT b.slot, u.email FROM bookings b
         JOIN providers p ON p.id = b.provider_id
         JOIN users u ON u.id = p.user_id AND u.deactivated_at IS NULL
        WHERE b.id = $1`, [bookingId]);
    if (!b) return;
    await sendMail({
      to: b.email,
      subject: 'A consultation was cancelled',
      text: [
        `The consultation at ${when(b.slot)} (Kigali time) was cancelled by the person who booked it.`,
        '',
        `Your appointments: ${appUrl()}/expert/appointments`,
      ].join('\n'),
      optional: true,
    });
  });
}

// The lawyer suggested another time for a waiting request. Only a signed-in person with an active
// account is told. The entry's name is given, never the topic or a personal name.
export function proposalSuggested(bookingId) {
  return fire(async () => {
    const [b] = await q(
      `SELECT b.proposed_slot AS slot, u.email, p.name AS provider_name
         FROM bookings b
         JOIN providers p ON p.id = b.provider_id
         JOIN users u ON u.id = b.user_id AND u.deactivated_at IS NULL
        WHERE b.id = $1 AND b.status = 'requested' AND b.proposed_slot IS NOT NULL`, [bookingId]);
    if (!b) return;
    await sendMail({
      to: b.email,
      subject: 'The lawyer suggested another time',
      text: [
        `${b.provider_name} suggested another time for your consultation: ${when(b.slot)} (Kigali time).`,
        '',
        `Accept or decline it on your appointments page: ${appUrl()}/appointments`,
      ].join('\n'),
      optional: true,
    });
  });
}

// The person answered the lawyer's suggested time. The lawyer gets the time only. The slot is passed
// in because the answer has already cleared the suggestion. Nothing says who answered.
export function proposalAnswered(bookingId, slot, accepted) {
  return fire(async () => {
    const [b] = await q(
      `SELECT u.email FROM bookings b
         JOIN providers p ON p.id = b.provider_id
         JOIN users u ON u.id = p.user_id AND u.deactivated_at IS NULL
        WHERE b.id = $1`, [bookingId]);
    if (!b) return;
    await sendMail({
      to: b.email,
      subject: accepted ? 'The person accepted your suggested time' : 'The person did not take the time you suggested',
      text: [
        accepted
          ? `The person accepted the time you suggested: ${when(slot)} (Kigali time).`
          : `The person did not take the time you suggested, ${when(slot)} (Kigali time). The request is still waiting.`,
        '',
        `Your appointments: ${appUrl()}/expert/appointments`,
      ].join('\n'),
      optional: true,
    });
  });
}

// The person moved a consultation. The new time waits for the lawyer to accept it. Optional mail: it
// stops at the daily budget. Nothing says the topic, a name or whether the booking is anonymous.
export function bookingMoved(bookingId) {
  return fire(async () => {
    const [b] = await q(
      `SELECT b.slot, u.email FROM bookings b
         JOIN providers p ON p.id = b.provider_id
         JOIN users u ON u.id = p.user_id AND u.deactivated_at IS NULL
        WHERE b.id = $1`, [bookingId]);
    if (!b) return;
    await sendMail({
      to: b.email,
      subject: 'A consultation time was changed',
      text: [
        `A consultation was moved to ${when(b.slot)} (Kigali time). It waits for you to accept the new time.`,
        '',
        `Your appointments: ${appUrl()}/expert/appointments`,
      ].join('\n'),
      optional: true,
    });
  });
}

// Auth routes: register and verify the email and resend the link and log in and log out.
// Also password reset and password change and the account a person manages themselves.
import { Router } from 'express';
import { q, pool } from '../db.js';
import {
  signToken, isAllowedEmail, normalizeEmail, ALLOWED_DOMAINS, requireAuth, revokeSessions,
} from '../middleware/auth.js';
import {
  loginEmailLimiter, resendLimiter, forgotPasswordLimiter, registerEmailLimiter, changeEmailLimiter,
  authIpLimiter, passwordChangeLimiter, accountPasswordLimiter,
} from '../middleware/rateLimit.js';
import { isPlausibleEmail } from '../middleware/validate.js';
import {
  hashPassword, checkPassword, checkPasswordOrDummy, passwordTooLong, PASSWORD_TOO_LONG,
} from '../passwords.js';
import { issueToken, consumeToken, tokenStatus } from '../services/authTokens.js';
import { sendMail, mailAvailable } from '../services/mailer.js';
import { consumeInvite, inviteStatus } from '../services/invites.js';
import { bookingCancelled } from '../services/notify.js';

const router = Router();

// GET /api/auth/mail-status: can this server send email at all?
// The sign-up page asks before it shows the form because an account that cannot be confirmed cannot be used.
// It answers one boolean and nothing about the mail setup. It gives no host and no login and no error text.
// It is not cached so a fixed setup shows on the next visit.
router.get('/mail-status', authIpLimiter, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ available: mailAvailable() });
});

// The log line for a failed send. It names the error and its code and never the message, because
// an SMTP message can carry an address.
const errorTag = (err) => [err?.name, err?.code].filter(Boolean).join(' ') || 'Error';

// What a sign-in returns. It is small on purpose.
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

// Email links point at the website and not at this API. The person clicks the link in their
// mail app and must land on a page. That page sends the token back here.
// The default is the Vite dev server.
const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');

// A person may move the account to another address. The new one waits in pending_email until its
// link is used. Students and staff must stay inside the ALU domains, as at sign-up. Legal experts
// and admins join from outside the university, so they may use any address.
const ALU_ONLY_ROLES = ['student', 'staff'];

// The only answer change-email gives for an address that passes the checks. It is the same whether
// the address is free or already has an account. A different answer would show which addresses
// are registered.
const CHANGE_EMAIL_REPLY = 'If that address can be used, a confirmation link is on its way to it. Your address does not change until you use the link.';

// a***@example.org. Enough for the owner to recognise it and not enough for anyone else to read it.
const maskEmail = (email) => {
  const [local, domain] = String(email).split('@');
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(local.length - 1, 2))}@${domain}`;
};

// The three things that can happen to a verification email, in words the person needs.
// Each one says what to do next. An apology with no next step leaves someone stuck.
function verificationSentMessage(email, delivery) {
  if (delivery?.failed) {
    return `Account created, but the verification email could not be sent to ${email} just now. Nothing is wrong with your account. Ask for a new link from the sign-in page.`;
  }
  if (delivery?.delivered === false) {
    // Dev mode. Saying "check your inbox" here would be false because nothing was sent.
    return 'Account created. This server has no mail set up, so no email was sent. The verification link is printed in the server log.';
  }
  // The address is named because a typo in it is the most common reason a sent message never arrives.
  return `Account created. Check ${email} for a link to verify your address. You can sign in once you have used it.`;
}

// Makes a verify_email token and mails the link. Register and resend both use this, so the
// two emails are the same. The raw token exists only inside this function and the email.
async function sendVerificationEmail(user) {
  const raw = await issueToken(user.id, 'verify_email');
  const link = `${appUrl()}/verify-email?token=${encodeURIComponent(raw)}`;
  return sendMail({
    to: user.email,
    subject: 'Verify your ALU Legal Companion account',
    text: [
      `Hi ${user.name},`,
      '',
      'Confirm this address to activate your ALU Legal Companion account:',
      link,
      '',
      'The link works once and expires in 24 hours.',
      'If you did not create this account you can ignore this message. Nobody can sign in until the link is used.',
    ].join('\n'),
  });
}

// POST /api/auth/register: students and staff with an ALU address only
router.post('/register', authIpLimiter, registerEmailLimiter, async (req, res) => {
  const { email, password, role } = req.body || {};
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password and role are required' });
  if (name.length > 100) return res.status(400).json({ error: 'Your name must be 100 characters or fewer.' });
  if (!['student', 'staff'].includes(role)) return res.status(400).json({ error: 'Role must be student or staff. Legal experts join by invitation only.' });
  if (!isPlausibleEmail(normalizeEmail(email)) || !isAllowedEmail(email)) {
    return res.status(400).json({ error: `Sign-up is limited to the ALU community: ${ALLOWED_DOMAINS.map((d) => '@' + d).join(' or ')}` });
  }
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (passwordTooLong(password)) return res.status(400).json({ error: PASSWORD_TOO_LONG });

  // An address that already has an account gets this 400 answer whether or not it was verified.
  // So the reply does reveal that the address exists. The wording points an unverified person
  // to the link and the sign-in page.
  // ON CONFLICT covers two sign-ups for one address at the same moment.
  const [user] = await q(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, name, email, role`,
    [name, normalizeEmail(email), await hashPassword(password), role],
  );
  if (!user) {
    return res.status(400).json({
      code: 'email_taken',
      error: 'An account with this email already exists. If you have not verified it yet, check your email for the link or ask for a new one on the sign-in page.',
    });
  }

  // No token is returned. Registering is not entry. The account stays unverified and login
  // refuses it until the link is used.
  //
  // A failed send must not fail the request. The account is already saved, so an error here
  // would report a failure that did not happen and the retry would hit "already exists".
  // Register is the only auth route that may say whether the email went out. It already shows
  // the account exists. The resend route must never say it. It would reveal which
  // addresses have an account.
  let delivery;
  try {
    delivery = await sendVerificationEmail(user);
  } catch (err) {
    console.error(`Could not send the verification email for user ${user.id}: ${errorTag(err)}`);
    delivery = { failed: true };
  }

  res.status(201).json({
    user: publicUser(user),
    message: verificationSentMessage(user.email, delivery),
  });
});

// POST /api/auth/verify-email: use the link and mark the address as proved. It never signs
// anyone in. Whoever clicks the link may not be the person who registered the address, so the
// reply carries no token and no user. The person signs in with their own password.
// This route may say why a link was refused. The caller already holds the token, so
// "already used" or "expired" tells them nothing new and each has a different next step.
router.post('/verify-email', authIpLimiter, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });

  const consumed = await consumeToken(token, 'verify_email');
  if (!consumed) {
    const why = await tokenStatus(token, 'verify_email');
    const message = {
      used: 'This link has already been used. Try signing in. If that does not work, ask for a new link.',
      expired: 'This verification link has expired. Request a new one and use it within 24 hours.',
    }[why] || 'That verification link is not valid. Request a new one from the sign-in page.';
    return res.status(400).json({ error: message });
  }

  // COALESCE keeps the first time the address was proved if a second link is used later.
  const [user] = await q(
    'UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1 RETURNING id, deactivated_at',
    [consumed.user_id],
  );
  if (!user) return res.status(400).json({ error: 'That account no longer exists. Please register again.' });

  // A switched-off account is refused here as it is at login.
  if (user.deactivated_at) {
    return res.status(403).json({
      error: 'This account is no longer active. If you think that is a mistake, contact the ALU Legal Companion team.',
    });
  }

  res.json({
    verified: true,
    message: 'Your email address is verified. Sign in with your email and password.',
  });
});

// The only answer resend-verification ever gives. It is a constant so a later edit cannot
// add something that differs between an address that has an account and one that does not.
const RESEND_REPLY = 'If that address has an account still waiting to be verified, a new link is on its way. Check your inbox and your spam folder.';

// POST /api/auth/resend-verification: the same answer to everybody, always.
// If it answered differently for an address with an account, anyone could learn which ALU
// addresses are registered without knowing a password. A link is sent only when the address
// has an account that is not verified yet. Older links stay valid until they expire.
router.post('/resend-verification', authIpLimiter, resendLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  // The reply goes first. The lookup and the send run after it, so the time taken to answer
  // never shows whether the address has an account. A failure is logged and changes nothing.
  res.json({ message: RESEND_REPLY });
  try {
    const [user] = await q(
      'SELECT id, name, email FROM users WHERE email = $1 AND email_verified_at IS NULL AND deactivated_at IS NULL',
      [normalizeEmail(email)],
    );
    if (user) await sendVerificationEmail(user);
  } catch (err) {
    console.error(`Could not resend the verification email: ${errorTag(err)}`);
  }
});

// POST /api/auth/login
router.post('/login', authIpLimiter, loginEmailLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const [user] = await q(
    'SELECT id, name, email, password_hash, role, email_verified_at, deactivated_at, session_version FROM users WHERE email = $1',
    [normalizeEmail(email)],
  );
  // With no account the password is checked against a dummy hash, so the reply takes as long either way.
  if (!(await checkPasswordOrDummy(String(password), user?.password_hash)) || !user) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  // The order of the two checks below is the point. They must stay under the 401 above.
  // An unknown address and a wrong password get the same answer so nobody can find out which
  // ALU addresses have accounts. "Not verified" and "switched off" are only told to someone
  // who already proved they know the password.
  // They are 403 and not 401. The password was right, so this is not a credential failure.
  // The website clears a saved login on 401 and keeps it on 403.
  // The code lets the sign-in page tell the two apart without reading the text.
  if (!user.email_verified_at) {
    return res.status(403).json({
      code: 'not_verified',
      error: 'Your email address is not verified yet. Check your inbox for the verification link we sent when you registered. You can ask for a new link from the sign-in page.',
    });
  }
  if (user.deactivated_at) {
    return res.status(403).json({
      code: 'deactivated',
      error: 'This account is no longer active. If you think that is a mistake, contact the ALU Legal Companion team.',
    });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me: the current state of your own account, read from the database.
// Fields are listed one by one and never copied from the row. The row has the password hash.
router.get('/me', requireAuth(), async (req, res) => {
  const [user] = await q(
    'SELECT id, name, email, role, email_verified_at, pending_email, created_at FROM users WHERE id = $1',
    [req.user.id],
  );
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  res.json({
    ...publicUser(user),
    email_verified_at: user.email_verified_at,
    // An address that is waiting for its link to be used. Empty when no change is under way.
    pending_email: user.pending_email,
    created_at: user.created_at,
  });
});

// POST /api/auth/logout: ends every session the account has.
// A signed token cannot be taken back, so this bumps session_version. That ends every session
// of the account, not only this one.
router.post('/logout', requireAuth(), async (req, res) => {
  await revokeSessions(req.user.id);
  res.status(204).end();
});

const LINKED_ACCOUNT_MESSAGE = 'Your account is linked to records you published. Ask an administrator to switch it off instead.';

// DELETE /api/auth/me { password, confirm: true }: a student or staff member erases their own account.
// Matters go with their files. Saved guides and sign-in tokens and own questions go too.
// An open booking is cancelled. Any booking that stays has no person and no topic.
// Lawyers and admins are tied to published records so an admin closes theirs.
router.delete('/me', authIpLimiter, loginEmailLimiter, requireAuth(), accountPasswordLimiter, async (req, res) => {
  if (!['student', 'staff'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Accounts for lawyers and admins are tied to published records. Ask an admin to close yours.',
    });
  }
  const { password, confirm } = req.body || {};
  if (confirm !== true || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Enter your password and confirm that you want to erase your account.' });
  }
  const [me] = await q('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!me || !(await checkPassword(password, me.password_hash))) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM matters WHERE user_id = $1', [me.id]);
    await client.query('DELETE FROM bookmarks WHERE user_id = $1', [me.id]);
    await client.query('DELETE FROM auth_tokens WHERE user_id = $1', [me.id]);
    await client.query('DELETE FROM questions WHERE user_id = $1', [me.id]);
    // An open booking is cancelled so no request or appointment stays open for the lawyer.
    // The earlier status is read in the same statement, so the lawyer is told only about accepted ones.
    const { rows: cancelled } = await client.query(
      `WITH open AS (SELECT id, status FROM bookings WHERE user_id = $1 AND status IN ('requested', 'accepted'))
       UPDATE bookings b SET status = 'cancelled', proposed_slot = NULL, proposed_at = NULL, user_id = NULL, topic = NULL
         FROM open WHERE b.id = open.id
       RETURNING b.id, open.status AS previous_status`,
      [me.id]);
    if (cancelled.length) {
      await client.query(
        `UPDATE booking_reminders SET status = 'cancelled' WHERE booking_id = ANY($1::int[]) AND status = 'pending'`,
        [cancelled.map((b) => b.id)]);
    }
    await client.query('UPDATE bookings SET user_id = NULL, topic = NULL WHERE user_id = $1', [me.id]);
    await client.query('DELETE FROM users WHERE id = $1', [me.id]);
    await client.query('COMMIT');
    // Sent after the commit. The mail reads only the slot and the lawyer's address.
    for (const b of cancelled) {
      if (b.previous_status === 'accepted') bookingCancelled(b.id);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // A published guide or entry, a review or an invitation still points at this account.
    if (err.code === '23503') {
      return res.status(409).json({ error: LINKED_ACCOUNT_MESSAGE });
    }
    return res.status(500).json({ error: 'Your account could not be erased. Nothing was changed. Please try again.' });
  } finally {
    client.release();
  }

  res.json({ ok: true });
});

// PUT /api/auth/me: rename yourself. The name is the only field this route reads.
// A role or an email in the same body changes nothing. Otherwise a profile form could
// become a way to give yourself a higher role.
router.put('/me', requireAuth(), async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'Your name cannot be empty.' });
  if (name.length > 100) return res.status(400).json({ error: 'Your name must be 100 characters or fewer.' });

  const [user] = await q(
    'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, role, session_version',
    [name, req.user.id],
  );
  // A fresh token is sent because the name is stored in the token and the header shows it.
  res.json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/change-password: ends every other session. The caller keeps this one
// because the new token carries the new session_version.
router.post('/change-password', authIpLimiter, requireAuth(), passwordChangeLimiter, async (req, res) => {
  const { current_password: currentPassword, new_password: newPassword } = req.body || {};

  // The new password is checked first so the caller learns the rule without having to
  // get the other field right.
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (passwordTooLong(newPassword)) return res.status(400).json({ error: PASSWORD_TOO_LONG });

  const [me] = await q('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!me || !(await checkPassword(String(currentPassword ?? ''), me.password_hash))) {
    // This is 400 and not 401. The session is fine. The caller typed a wrong password.
    // The website treats every 401 as an ended session and signs the person out. A typo here
    // must not do that.
    return res.status(400).json({ error: 'That password is not correct.' });
  }

  // Always the id from the session. This route can only change the caller's own account.
  const [updated] = await q(
    `UPDATE users SET password_hash = $1, session_version = session_version + 1
      WHERE id = $2 RETURNING id, name, email, role, session_version`,
    [await hashPassword(newPassword), me.id],
  );
  res.json({ token: signToken(updated), user: publicUser(updated) });
});

// POST /api/auth/change-email { email, current_password }: ask to move the account to another address.
// Nothing changes yet. The new address waits in pending_email and a link goes to it. The account keeps
// working with the old address until the link is used, so a typo can never lock anyone out.
// The current password is needed so that a stolen session alone cannot send an account somewhere else.
router.post('/change-email', authIpLimiter, requireAuth(), accountPasswordLimiter, changeEmailLimiter, async (req, res) => {
  const { email: typed, current_password: currentPassword } = req.body || {};
  const email = normalizeEmail(typed);
  // The address is checked first so the caller learns the rule without having to get the password right.
  if (!isPlausibleEmail(email)) {
    return res.status(400).json({ error: 'That is not a valid email address.' });
  }

  const [me] = await q('SELECT id, name, email, role, password_hash FROM users WHERE id = $1', [req.user.id]);
  // This is 400 and not 401. The session is fine. The caller typed a wrong password. The website
  // signs a person out on every 401 and a typo must not do that.
  if (!me || !(await checkPassword(String(currentPassword ?? ''), me.password_hash))) {
    return res.status(400).json({ error: 'That password is not correct.' });
  }
  if (email === me.email) return res.status(400).json({ error: 'That is already the address of your account.' });
  if (ALU_ONLY_ROLES.includes(me.role) && !isAllowedEmail(email)) {
    return res.status(400).json({
      error: `Students and staff must use an address from the ALU community: ${ALLOWED_DOMAINS.map((d) => '@' + d).join(' or ')}`,
    });
  }

  // The reply goes first. The lookup and the sends run after it, so the time taken to answer never
  // shows whether the address has an account. A failure is logged and changes nothing.
  res.json({ message: CHANGE_EMAIL_REPLY });
  try {
    await startEmailChange(me, email);
  } catch (err) {
    console.error(`Could not start the email change for user ${me.id}: ${errorTag(err)}`);
  }
});

// An address that already has an account gets the same answer as a free one. Nothing is stored and
// nothing is sent.
async function startEmailChange(me, email) {
  const [taken] = await q('SELECT id FROM users WHERE email = $1', [email]);
  if (!taken) {
    await q('UPDATE users SET pending_email = $1 WHERE id = $2', [email, me.id]);
    // An older link is cancelled so only the newest request can be used.
    await q(`UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = 'change_email' AND used_at IS NULL`, [me.id]);
    const raw = await issueToken(me.id, 'change_email');
    const link = `${appUrl()}/confirm-email-change?token=${encodeURIComponent(raw)}`;

    // The old address is told first and the link goes last. A failed send must not change the answer.
    // The log never holds an address.
    try {
      await sendMail({
        to: me.email,
        subject: 'A request to change your email address',
        text: [
          `Hi ${me.name},`,
          '',
          `Someone asked to change the email address of your ALU Legal Companion account to ${maskEmail(email)}.`,
          'Nothing has changed yet. If it was you, use the link that was sent to the new address.',
          'If it was not you, sign in and change your password in Account settings.',
        ].join('\n'),
      });
    } catch (err) {
      console.error(`Could not send the change notice for user ${me.id}: ${errorTag(err)}`);
    }
    try {
      await sendMail({
        to: email,
        subject: 'Confirm your new email address',
        text: [
          `Hi ${me.name},`,
          '',
          'Confirm this address for your ALU Legal Companion account:',
          link,
          '',
          'The link works once and expires in 24 hours.',
          'Until you use it the account keeps its old address.',
          'If you did not ask for this you can ignore this message.',
        ].join('\n'),
      });
    } catch (err) {
      console.error(`Could not send the confirmation link for user ${me.id}: ${errorTag(err)}`);
    }
  }
}

// POST /api/auth/confirm-email-change { token }: use the link sent to the new address.
// The link works on any device because reading it proves the mailbox is the person's.
// It switches the address and counts it as verified. It ends every older session and signs the person in again.
// Like verify-email it may say why a link was refused because the caller already holds the token.
router.post('/confirm-email-change', authIpLimiter, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });

  const consumed = await consumeToken(token, 'change_email');
  if (!consumed) {
    const why = await tokenStatus(token, 'change_email');
    const message = {
      used: 'This link has already been used. Sign in with your new address. If that does not work, ask for a new link in Account settings.',
      expired: 'This link has expired. Ask for a new one in Account settings and use it within 24 hours.',
    }[why] || 'That link is not valid. Ask for a new one in Account settings.';
    return res.status(400).json({ error: message });
  }

  const [before] = await q('SELECT email FROM users WHERE id = $1', [consumed.user_id]);
  let user;
  try {
    // One statement does it all so no half-done state can be seen. session_version goes up so every
    // older login ends. The new token that comes back carries the new number.
    [user] = await q(
      `UPDATE users
          SET email = pending_email, pending_email = NULL,
              email_verified_at = now(), session_version = session_version + 1
        WHERE id = $1 AND pending_email IS NOT NULL AND deactivated_at IS NULL
        RETURNING id, name, email, role, session_version`,
      [consumed.user_id],
    );
  } catch (err) {
    // Someone made an account with that address after the link was sent. The unique rule stops the switch.
    if (err.code === '23505') {
      return res.status(400).json({ error: 'That address now belongs to another account. Ask for the change again with a different address.' });
    }
    throw err;
  }
  if (!user) {
    return res.status(400).json({ error: 'No new address is waiting for this account. Ask for the change again in Account settings.' });
  }

  // The old address is told that the account moved. It is the early warning if the change was not wanted.
  try {
    await sendMail({
      to: before.email,
      subject: 'Your email address was changed',
      text: [
        `Hi ${user.name},`,
        '',
        `The email address of your ALU Legal Companion account was changed to ${maskEmail(user.email)}.`,
        'If you did not do this, contact the ALU Legal Companion team at once.',
      ].join('\n'),
    });
  } catch (err) {
    console.error(`Could not send the change notice for user ${user.id}: ${errorTag(err)}`);
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// Makes a reset_password token and mails the link. The raw token exists only inside this
// function and the email. The link points at the website for the same reason as the
// verification link.
async function sendPasswordResetEmail(user) {
  const raw = await issueToken(user.id, 'reset_password');
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(raw)}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your ALU Legal Companion password',
    text: [
      `Hi ${user.name},`,
      '',
      'Someone asked to reset the password for this ALU Legal Companion account. Use this link to choose a new one:',
      link,
      '',
      'The link works once and expires in 24 hours.',
      'If you did not ask for this you can ignore this message. Your password has not changed. Asking for a new link cancels this one.',
    ].join('\n'),
  });
}

// The only answer forgot-password ever gives. It is a constant for the same reason as the
// resend answer.
const FORGOT_PASSWORD_REPLY = 'If that address has an account, a reset link is on its way. Check your inbox and your spam folder.';

// POST /api/auth/forgot-password: the same answer to everybody, always.
// It must never show which addresses have an account. A send failure does not change the
// reply either. Only an address with an account can fail to send so an error would show it.
// Unlike resend, this works for verified accounts too because they are the ones who forget.
// It also cancels the older reset links. An old email in a shared mailbox is a way in, so
// only the newest link may work.
router.post('/forgot-password', authIpLimiter, forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  // The reply goes first. The lookup and the send run after it, so the time taken to answer
  // never shows whether the address has an account. A failure is logged and changes nothing.
  res.json({ message: FORGOT_PASSWORD_REPLY });
  try {
    const [user] = await q(
      'SELECT id, name, email FROM users WHERE email = $1 AND deactivated_at IS NULL',
      [normalizeEmail(email)],
    );
    if (user) {
      // The old links are cancelled before the new one is made so the new one is not hit.
      await q(
        `UPDATE auth_tokens SET used_at = now()
          WHERE user_id = $1 AND purpose = 'reset_password' AND used_at IS NULL`,
        [user.id],
      );
      await sendPasswordResetEmail(user);
    }
  } catch (err) {
    console.error(`Could not send the password reset email: ${errorTag(err)}`);
  }
});

// POST /api/auth/reset-password: use the link and set a new password. This signs the person in.
// Like verify-email it may say why a link was refused because the caller holds the token.
router.post('/reset-password', authIpLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
  // Checked before the link is used. A link works once. It must not be burned on a password
  // the server was always going to refuse.
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (passwordTooLong(password)) return res.status(400).json({ error: PASSWORD_TOO_LONG });

  const consumed = await consumeToken(token, 'reset_password');
  if (!consumed) {
    const why = await tokenStatus(token, 'reset_password');
    const message = {
      used: 'This link has already been used. If you still need to reset your password, ask for a new link.',
      expired: 'This password reset link has expired. Request a new one and use it within 24 hours.',
    }[why] || 'That password reset link is not valid. Request a new one from the sign-in page.';
    return res.status(400).json({ error: message });
  }

  // Three things happen in one statement.
  // The password changes. The address counts as verified because reading this link proves
  // the person owns the mailbox. Without that an unverified person would reset the password
  // and still be locked out. And session_version goes up so every older session ends.
  const [user] = await q(
    `UPDATE users
        SET password_hash     = $1,
            email_verified_at = COALESCE(email_verified_at, now()),
            session_version   = session_version + 1
      WHERE id = $2 AND deactivated_at IS NULL
      RETURNING id, name, email, role, session_version`,
    [await hashPassword(password), consumed.user_id],
  );
  if (!user) return res.status(400).json({ error: 'This account cannot be reset. If you think that is a mistake, contact the ALU Legal Companion team.' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/redeem-invite: the only way to become a legal expert.
// The invitation was emailed to the person, so using it proves they own the address. That is
// why the new account counts as verified. Like verify-email this route may say why a link was
// refused because the caller already holds the token.
router.post('/redeem-invite', authIpLimiter, async (req, res) => {
  const { invite_token: inviteToken, name: rawName, password } = req.body || {};
  if (!inviteToken || !rawName || !password) {
    return res.status(400).json({ error: 'invite_token, name and password are required' });
  }
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (!name || name.length > 100) return res.status(400).json({ error: 'Your name must be 1 to 100 characters' });
  // Checked before the invitation is used. The link works once and must not be burned on a
  // password the server was always going to refuse.
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (passwordTooLong(password)) return res.status(400).json({ error: PASSWORD_TOO_LONG });

  // The password is hashed first. The invitation is used and the account made in one
  // transaction, so a failure leaves the invitation working.
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  let invite;
  let user;
  try {
    await client.query('BEGIN');
    invite = await consumeInvite(inviteToken, client);
    if (invite) {
      // ON CONFLICT covers an account made with this address after the invitation was sent.
      ({ rows: [user] } = await client.query(
        `INSERT INTO users (name, email, password_hash, role, email_verified_at)
         VALUES ($1, $2, $3, 'legal_expert', now())
         ON CONFLICT (email) DO NOTHING
         RETURNING id, name, email, role, session_version`,
        [name, invite.email, passwordHash]));
    }
    // With no account made the rollback gives the invitation back.
    await client.query(user ? 'COMMIT' : 'ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (!invite) {
    const why = await inviteStatus(inviteToken);
    const message = {
      used: 'This invitation has already been used or replaced by a newer one. Ask the admin for a new invitation if you need one.',
      expired: 'This invitation has expired. Ask the admin for a new one.',
    }[why] || 'That invitation is not valid. Ask the admin for a new one.';
    return res.status(400).json({ error: message });
  }
  // An address that already has an account gets this 400 answer whether or not it was verified.
  // The transaction rolled back, so the invitation is still usable with another address.
  if (!user) {
    return res.status(400).json({
      code: 'email_taken',
      error: 'An account with this email already exists. Use a different address for this invitation, or sign in with the existing account.',
    });
  }

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

export default router;

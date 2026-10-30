// Auth routes: register, verify the email, resend the link, log in and log out.
// Also password reset, password change and the account a person manages themselves.
import { Router } from 'express';
import { q } from '../db.js';
import {
  signToken, isAllowedEmail, normalizeEmail, ALLOWED_DOMAINS, requireAuth, revokeSessions,
} from '../middleware/auth.js';
import { loginEmailLimiter, emailLimiter, authIpLimiter } from '../middleware/rateLimit.js';
import { hashPassword, checkPassword } from '../passwords.js';
import { issueToken, consumeToken, tokenStatus } from '../services/authTokens.js';
import { sendMail } from '../services/mailer.js';
import { consumeInvite, releaseInvite, inviteStatus } from '../services/invites.js';

const router = Router();

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
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
router.post('/register', authIpLimiter, async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password and role are required' });
  if (!['student', 'staff'].includes(role)) return res.status(400).json({ error: 'Role must be student or staff. Legal experts join by invitation only.' });
  if (!isAllowedEmail(email)) {
    return res.status(400).json({ error: `Sign-up is limited to the ALU community: ${ALLOWED_DOMAINS.map((d) => '@' + d).join(' or ')}` });
  }
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = await q('SELECT id FROM users WHERE email = $1', [normalizeEmail(email)]);
  if (existing.length) return res.status(400).json({ error: 'An account with this email already exists' });

  const [user] = await q(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
    [name, normalizeEmail(email), await hashPassword(password), role],
  );

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
    console.error(`Could not send the verification email for user ${user.id}: ${err.message}`);
    delivery = { failed: true };
  }

  res.status(201).json({
    user: publicUser(user),
    message: verificationSentMessage(user.email, delivery),
  });
});

// POST /api/auth/verify-email: use the link, prove the address and sign the person in.
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
    'UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1 RETURNING id, name, email, role, session_version, deactivated_at',
    [consumed.user_id],
  );
  if (!user) return res.status(400).json({ error: 'That account no longer exists. Please register again.' });

  // A switched-off account gets no token here, the same as at login. The session check would
  // reject the token anyway. Refusing to make it keeps both ways in consistent.
  if (user.deactivated_at) {
    return res.status(403).json({
      error: 'This account is no longer active. If you think that is a mistake, contact the ALU Legal Companion team.',
    });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

// The only answer resend-verification ever gives. It is a constant so a later edit cannot
// add something that differs between an address that has an account and one that does not.
const RESEND_REPLY = 'If that address has an account still waiting to be verified, a new link is on its way. Check your inbox and your spam folder.';

// POST /api/auth/resend-verification: the same answer to everybody, always.
// If it answered differently for an address with an account, anyone could learn which ALU
// addresses are registered without knowing a password. A link is sent only when the address
// has an account that is not verified yet. Older links stay valid until they expire.
router.post('/resend-verification', authIpLimiter, emailLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  const [user] = await q(
    'SELECT id, name, email FROM users WHERE email = $1 AND email_verified_at IS NULL AND deactivated_at IS NULL',
    [normalizeEmail(email)],
  );
  if (user) {
    // A send failure must not change the reply. That would show the account exists.
    try {
      await sendVerificationEmail(user);
    } catch (err) {
      console.error(`Could not resend the verification email for user ${user.id}: ${err.message}`);
    }
  }

  res.json({ message: RESEND_REPLY });
});

// POST /api/auth/login
router.post('/login', authIpLimiter, loginEmailLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const [user] = await q(
    'SELECT id, name, email, password_hash, role, email_verified_at, deactivated_at, session_version FROM users WHERE email = $1',
    [normalizeEmail(email)],
  );
  if (!user || !(await checkPassword(String(password), user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  // The order of the two checks below is the point. They must stay under the 401 above.
  // An unknown address and a wrong password get the same answer so nobody can find out which
  // ALU addresses have accounts. "Not verified" and "switched off" are only told to someone
  // who already proved they know the password.
  // They are 403 and not 401. The password was right, so this is not a credential failure.
  // The website clears a saved login on 401 and keeps it on 403.
  if (!user.email_verified_at) {
    return res.status(403).json({
      error: 'Your email address is not verified yet. Check your inbox for the verification link we sent when you registered. You can ask for a new link from the sign-in page.',
    });
  }
  if (user.deactivated_at) {
    return res.status(403).json({
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
// A signed token cannot be taken back. Before this existed, signing out only cleared the
// browser's copy. The same token still worked from anywhere for seven days.
// It ends all sessions and not only this one. Someone signing out of a library computer
// means "end this" and cannot list their other sessions to choose. Signing out on a phone
// also signs out a laptop. That is the safe side to be on.
router.post('/logout', requireAuth(), async (req, res) => {
  await revokeSessions(req.user.id);
  res.status(204).end();
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

// POST /api/auth/change-password: the signed-in version of a reset.
// It ends every other session. People change a password when they think someone else has
// got in. The caller keeps a session because the new token carries the new number.
router.post('/change-password', authIpLimiter, requireAuth(), async (req, res) => {
  const { current_password: currentPassword, new_password: newPassword } = req.body || {};

  // The new password is checked first so the caller learns the rule without having to
  // get the other field right.
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

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
router.post('/change-email', authIpLimiter, requireAuth(), emailLimiter, async (req, res) => {
  const { email: typed, current_password: currentPassword } = req.body || {};
  const email = normalizeEmail(typed);
  // The address is checked first so the caller learns the rule without having to get the password right.
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
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

  // An address that already has an account gets the same answer as a free one. Nothing is stored and
  // nothing is sent.
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
      console.error(`Could not send the change notice for user ${me.id}: ${err.message}`);
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
      console.error(`Could not send the confirmation link for user ${me.id}: ${err.message}`);
    }
  }
  res.json({ message: CHANGE_EMAIL_REPLY });
});

// POST /api/auth/confirm-email-change { token }: use the link sent to the new address.
// The link works on any device because reading it proves the mailbox is the person's. It switches the
// address, counts it as verified, ends every older session and signs the person in again.
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
    console.error(`Could not send the change notice for user ${user.id}: ${err.message}`);
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
router.post('/forgot-password', authIpLimiter, emailLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  const [user] = await q(
    'SELECT id, name, email FROM users WHERE email = $1 AND deactivated_at IS NULL',
    [normalizeEmail(email)],
  );
  if (user) {
    try {
      // The old links are cancelled before the new one is made so the new one is not hit.
      await q(
        `UPDATE auth_tokens SET used_at = now()
          WHERE user_id = $1 AND purpose = 'reset_password' AND used_at IS NULL`,
        [user.id],
      );
      await sendPasswordResetEmail(user);
    } catch (err) {
      console.error(`Could not send the password reset email for user ${user.id}: ${err.message}`);
    }
  }

  res.json({ message: FORGOT_PASSWORD_REPLY });
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
  // The reset is what people do when they think someone else has got in.
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

  const invite = await consumeInvite(inviteToken);
  if (!invite) {
    const why = await inviteStatus(inviteToken);
    const message = {
      used: 'This invitation has already been used or replaced by a newer one. Ask the admin for a new invitation if you need one.',
      expired: 'This invitation has expired. Ask the admin for a new one.',
    }[why] || 'That invitation is not valid. Ask the admin for a new one.';
    return res.status(400).json({ error: message });
  }

  // ON CONFLICT covers an account made with this address after the invitation was sent.
  const [user] = await q(
    `INSERT INTO users (name, email, password_hash, role, email_verified_at)
     VALUES ($1, $2, $3, 'legal_expert', now())
     ON CONFLICT (email) DO NOTHING
     RETURNING id, name, email, role, session_version`,
    [name, invite.email, await hashPassword(password)]);
  if (!user) {
    // No account was made, so the invitation is given back and not wasted.
    await releaseInvite(invite.id);
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

export default router;

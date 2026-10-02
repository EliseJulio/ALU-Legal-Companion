// Auth routes: register, verify email, login and the signed-in user
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import {
  signToken, isAllowedEmail, normalizeEmail, ALLOWED_DOMAINS, BCRYPT_ROUNDS, requireAuth,
  revokeSessions,
} from '../middleware/auth.js';
import {
  loginEmailLimiter, loginIpLimiter, registerLimiter, verifyEmailLimiter,
  resendEmailLimiter, resendIpLimiter,
  forgotPasswordEmailLimiter, forgotPasswordIpLimiter, resetPasswordLimiter,
} from '../middleware/rateLimit.js';
import { issueToken, consumeToken, tokenStatus } from '../services/authTokens.js';
import { sendMail } from '../services/mailer.js';

const router = Router();

// The user details that are safe to send to the browser. Never the password hash.
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

// The link in the email goes to the website (the frontend) not to this API. The person
// clicks it in their mail app and lands on a page and that page sends the token back here.
const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');

// What to tell the person after sign-up. There are three cases and each needs a different
// message so nobody waits for an email that was never sent.
function verificationSentMessage(email, delivery) {
  if (delivery?.failed) {
    return `Account created but the verification email could not be sent to ${email} just now. Nothing is wrong with your account. Ask for a new link from the sign-in page.`;
  }
  if (delivery?.delivered === false) {
    // Dev mode: no email left this computer, so do not say "check your inbox".
    return 'Account created. This server has no mail set up, so no email was sent. The verification link is printed in the server log.';
  }
  return `Account created. Check ${email} for a link to verify your address. You can sign in once you have used it.`;
}

// Makes a verification link and emails it. Register and resend both use this so the two
// emails are always the same. The real token only exists here and inside the email.
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
      'If you did not create this account, you can ignore this email. Nobody can sign in until the link is used.',
    ].join('\n'),
  });
}

// Makes a password reset link and emails it. Like the verification link, the real token only
// exists here and inside the email.
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
      'If you did not ask for this, you can ignore this email. Your password has not changed, and asking for a new link cancels this one.',
    ].join('\n'),
  });
}

// POST /api/auth/register: students and staff only with an ALU email address
router.post('/register', registerLimiter, async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password must be text' });
  }
  if (!['student', 'staff'].includes(role)) {
    return res.status(400).json({ error: 'Role must be student or staff. Legal experts join by invitation only.' });
  }
  if (!isAllowedEmail(email)) {
    return res.status(400).json({ error: `Sign-up is limited to the ALU community: ${ALLOWED_DOMAINS.map((d) => '@' + d).join(' or ')}` });
  }
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = await q('SELECT id FROM users WHERE email = $1', [normalizeEmail(email)]);
  if (existing.length) return res.status(400).json({ error: 'An account with this email already exists' });

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const [user] = await q(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
    [name, normalizeEmail(email), hash, role],
  );

  // No token here. Registering does not sign you in. The account stays unverified and
  // login refuses it until the emailed link is used.
  let delivery;
  try {
    delivery = await sendVerificationEmail(user);
  } catch (err) {
    // If the email fails, the account still exists. Answering with an error would be wrong
    // and trying to register again would say "already exists". Log the reason never the link.
    console.error(`Could not send the verification email for user ${user.id}: ${err.message}`);
    delivery = { failed: true };
  }

  res.status(201).json({
    user: publicUser(user),
    message: verificationSentMessage(user.email, delivery),
  });
});

// POST /api/auth/verify-email: use the link, prove the email and sign the user in.
// This is the one place that says why a link was refused. That is safe because the person
// already holds the link and "used" and "expired" need different next steps.
router.post('/verify-email', verifyEmailLimiter, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });

  const consumed = await consumeToken(token, 'verify_email');
  if (!consumed) {
    const why = await tokenStatus(token, 'verify_email');
    const message = {
      used: 'This link has already been used. Try signing in. If that does not work, ask for a new link.',
      expired: 'This verification link has expired. Ask for a new one and use it within 24 hours.',
    }[why] || 'That verification link is not valid. Ask for a new one from the sign-in page.';
    return res.status(400).json({ error: message });
  }

  // COALESCE keeps the first verification time if a second valid link is used later.
  const [user] = await q(
    'UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1 RETURNING id, name, email, role, session_version',
    [consumed.user_id],
  );
  if (!user) return res.status(400).json({ error: 'That account no longer exists. Please register again.' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

// The one answer resend-verification always gives. It is a fixed text so a later edit cannot
// make the answer differ between the two cases.
const RESEND_REPLY = 'If that address has an account still waiting to be verified, a new link is on its way. Check your inbox, and your spam folder.';

// POST /api/auth/resend-verification: the same answer for everybody.
// Do not make this answer more helpful. If it answered differently for an email that has an
// account, anyone could use it to find out which ALU emails are registered.
router.post('/resend-verification', resendIpLimiter, resendEmailLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  const [user] = await q(
    'SELECT id, name, email FROM users WHERE email = $1 AND email_verified_at IS NULL',
    [normalizeEmail(email)],
  );
  if (user) {
    // A failed send must not change the answer, or it would reveal that the account exists.
    try {
      await sendVerificationEmail(user);
    } catch (err) {
      console.error(`Could not resend the verification email for user ${user.id}: ${err.message}`);
    }
  }
  res.json({ message: RESEND_REPLY });
});

// POST /api/auth/login
router.post('/login', loginIpLimiter, loginEmailLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password must be text' });
  }

  const [user] = await q(
    'SELECT id, name, email, password_hash, role, email_verified_at, session_version FROM users WHERE email = $1',
    [normalizeEmail(email)],
  );
  // Give the same answer for an unknown email and a wrong password. This way nobody can use
  // the login form to find out which emails have an account.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  // This check must stay below the one above. Saying "not verified" before the password is
  // checked would show which emails have accounts. It is a 403 and not a 401 because the
  // password was right.
  if (!user.email_verified_at) {
    return res.status(403).json({
      error: 'Your email address is not verified yet. Check your inbox for the verification link we sent when you registered. You can ask for a new link from the sign-in page.',
    });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me: the signed-in user as they are in the database now. This can differ from
// the token if their role has changed. It also reports the state of the account, so the
// settings page can show if the email is confirmed and if a change is waiting.
// The fields are listed one by one and never copied with `...user`, because the row also has
// the password hash.
router.get('/me', requireAuth(), async (req, res) => {
  const [user] = await q(
    'SELECT id, name, email, role, email_verified_at, pending_email, created_at FROM users WHERE id = $1',
    [req.user.id],
  );
  res.json({
    ...publicUser(user),
    email_verified_at: user.email_verified_at,
    // null and not left out, so "nothing is waiting" is clear to the page.
    pending_email: user.pending_email ?? null,
    created_at: user.created_at,
  });
});

// PUT /api/auth/me: change your name.
// It reads the name and nothing else. If it read the whole body, someone could send
// role: "admin" and make themselves an admin. The email has its own flow below because it needs
// proof, and the role can never be changed by the user.
router.put('/me', requireAuth(), async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'Your name cannot be empty.' });

  const [user] = await q(
    'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, role, session_version',
    [name, req.user.id],
  );
  // A new token, because the name is stored in the token and the header shows it from there.
  res.json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/change-email: ask to move to a new email address.
// Only `pending_email` changes here. The address moves once the new mailbox confirms it (see
// confirm-email-change). If the address changed first, one typo would lock the person out of
// their own account, because login needs a verified email.
//
// The current password is needed. A session alone is not enough, because the email is the
// way to reset the password. Whoever controls it can take the account.
router.post('/change-email', requireAuth(), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { password } = req.body || {};
  if (typeof req.body?.email !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const [me] = await q(
    'SELECT id, name, email, role, password_hash FROM users WHERE id = $1',
    [req.user.id],
  );
  if (!me || !(await bcrypt.compare(String(password), me.password_hash))) {
    return res.status(401).json({ error: 'That password is not correct.' });
  }

  // The ALU domain rule depends on the role. Students and staff are ALU people, so they must
  // keep an ALU address. Legal experts are invited from outside the university, so the same
  // rule would stop them changing their address at all.
  if ((me.role === 'student' || me.role === 'staff') && !isAllowedEmail(email)) {
    return res.status(400).json({
      error: `Students and staff must use an ALU address (${ALLOWED_DOMAINS.join(' or ')}).`,
    });
  }

  if (email === me.email) return res.status(400).json({ error: 'That is already your address.' });

  // This tells the person plainly that the address is taken. It is fine here, because they are
  // signed in and have just given their password. Silently doing nothing would be worse.
  const [taken] = await q('SELECT 1 FROM users WHERE email = $1', [email]);
  if (taken) return res.status(400).json({ error: 'Another account already uses that address.' });

  await q('UPDATE users SET pending_email = $1 WHERE id = $2', [email, me.id]);
  const raw = await issueToken(me.id, 'change_email', 24);

  // The link goes to the NEW address. Opening it proves they own that mailbox.
  try {
    await sendMail({
      to: email,
      subject: 'Confirm your new ALU Legal Companion address',
      text: [
        `Hi ${me.name},`,
        '',
        `Someone asked to move the ALU Legal Companion account that uses ${me.email} to this address. Confirm it with this link:`,
        `${appUrl()}/confirm-email-change?token=${encodeURIComponent(raw)}`,
        '',
        'The link works once and expires in 24 hours. Until you use it, the account keeps its old address.',
        'If you did not ask for this, ignore this email. Nothing has changed.',
      ].join('\n'),
    });
  } catch (err) {
    // The pending change already exists, so answering with an error would hide that from the
    // person. Log the reason and carry on, like register does.
    console.error('[change-email] send failed', { userId: me.id, message: err.message });
  }

  res.json({ message: `Check ${email} for a link to confirm the change. Your address stays as it is until you do.` });
});

// POST /api/auth/confirm-email-change: use the link from the new mailbox.
// It does not need a login on purpose. The person may open the email in a browser that is not
// signed in, and the token is the proof.
router.post('/confirm-email-change', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });

  const consumed = await consumeToken(token, 'change_email');
  if (!consumed) {
    const why = await tokenStatus(token, 'change_email');
    const message = {
      used: 'This link has already been used. Your address has not changed again.',
      expired: 'This confirmation link has expired. Ask for the change again from your settings.',
    }[why] || 'That confirmation link is not valid. Ask for the change again from your settings.';
    return res.status(400).json({ error: message });
  }

  const [me] = await q('SELECT id, pending_email FROM users WHERE id = $1', [consumed.user_id]);
  if (!me) return res.status(400).json({ error: 'That account no longer exists.' });
  if (!me.pending_email) {
    return res.status(400).json({ error: 'There is no address change waiting on this account.' });
  }

  // Check again that the address is free. Someone else could have registered it while this
  // link sat in an inbox. Without this check the person would see a server error.
  const [taken] = await q('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [me.pending_email, me.id]);
  if (taken) {
    await q('UPDATE users SET pending_email = NULL WHERE id = $1', [me.id]);
    return res.status(400).json({ error: 'Another account has already taken that address. Your address is unchanged.' });
  }

  // Opening the link proves they own the new mailbox, so the email counts as verified.
  // session_version goes up by 1 because moving the email is a way to take over an account, so
  // every session opened before the move should end.
  const [updated] = await q(
    `UPDATE users
        SET email = pending_email,
            pending_email = NULL,
            email_verified_at = now(),
            session_version = session_version + 1
      WHERE id = $1
      RETURNING id, name, email, role, session_version`,
    [me.id],
  );

  // Signed in again on the new address, with a token that has the new session_version.
  res.json({ token: signToken(updated), user: publicUser(updated) });
});

// POST /api/auth/change-password: the signed-in version of a password reset.
// It ends every OTHER session, for the same reason as a reset: people do this when they think
// their account is compromised. The person keeps their own session, because the token sent
// back has the new session_version.
router.post('/change-password', requireAuth(), async (req, res) => {
  const { current_password: currentPassword, new_password: newPassword } = req.body || {};

  // Checked first, so the person learns the rule without needing the other field to be right.
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const [me] = await q('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!me || !(await bcrypt.compare(String(currentPassword ?? ''), me.password_hash))) {
    return res.status(401).json({ error: 'That password is not correct.' });
  }

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  // Always the signed-in user's id, never an id from the request body.
  const [updated] = await q(
    `UPDATE users SET password_hash = $1, session_version = session_version + 1
      WHERE id = $2 RETURNING id, name, email, role, session_version`,
    [hash, me.id],
  );
  res.json({ token: signToken(updated), user: publicUser(updated) });
});

// POST /api/auth/logout: ends every session this account has.
// A signed token cannot be taken back. Before this "signing out" only cleared the browser's
// copy and the same token still worked from anywhere for 7 days. This ends all of the
// account's sessions, not only this one. Someone signing out on a shared computer cannot list
// their other sessions so ending them all is the safe choice.
// 204 means it worked and there is nothing to send back.
router.post('/logout', requireAuth(), async (req, res) => {
  await revokeSessions(req.user.id);
  res.status(204).end();
});

// The one answer forgot-password always gives. It is a fixed text so a later edit cannot make
// the answer differ between the two cases.
const FORGOT_PASSWORD_REPLY = 'If that address has an account, a reset link is on its way. Check your inbox, and your spam folder.';

// POST /api/auth/forgot-password: the same answer for everybody.
// This works like resend-verification and has the same rule, do not make the answer more
// helpful or anyone could use it to find out which ALU emails have an account. A failed send
// must not change the answer either.
//
// Unlike resend-verification this also works for verified accounts because they are the
// ones who forget passwords. It also cancels the account's older unused reset links. An old
// reset email could sit in a mailbox someone else reads later so only the newest one works.
// Only reset links are cancelled. A waiting verification link is a different purpose.
router.post('/forgot-password', forgotPasswordIpLimiter, forgotPasswordEmailLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  const [user] = await q(
    'SELECT id, name, email FROM users WHERE email = $1',
    [normalizeEmail(email)],
  );
  if (user) {
    try {
      // Cancel the old links first so the new one is not cancelled too.
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

// POST /api/auth/reset-password: use the link set the new password and sign the user in.
// Like verify-email this one says why a link was refused. That is safe because the person
// already holds the link.
router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
  // Check the password before using up the link. The link works once, so it must not be
  // wasted on a password we were always going to refuse.
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const consumed = await consumeToken(token, 'reset_password');
  if (!consumed) {
    const why = await tokenStatus(token, 'reset_password');
    const message = {
      used: 'This link has already been used. If you still need to reset your password, ask for a new link.',
      expired: 'This password reset link has expired. Ask for a new one and use it within 24 hours.',
    }[why] || 'That password reset link is not valid. Ask for a new one from the sign-in page.';
    return res.status(400).json({ error: message });
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  // One statement does three things:
  //   - sets the new password;
  //   - marks the email as verified. Opening the link proves they own the mailbox. Without
  //     this, an unverified person would reset their password and still not get in;
  //   - adds 1 to session_version so every session open before the reset ends. A reset is what
  //     someone does when they think their account is taken over.
  // Doing all three together means there is no moment where the new password works but the old
  // sessions still do. The token below is made with the new session_version, so the person
  // who reset stays signed in.
  const [user] = await q(
    `UPDATE users
        SET password_hash     = $1,
            email_verified_at = COALESCE(email_verified_at, now()),
            session_version   = session_version + 1
      WHERE id = $2
      RETURNING id, name, email, role, session_version`,
    [hash, consumed.user_id],
  );
  if (!user) return res.status(400).json({ error: 'That account no longer exists. Please register again.' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

export default router;

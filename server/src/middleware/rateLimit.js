// Rate limits. They cap how often one person, or one email address, can try something in a
// time window. They slow down password guessing and stop anyone filling an inbox with emails.
//
// Login has two limits:
//   - loginEmailLimiter is strict and counts attempts per email. This is the real defence
//     against password guessing. It does not matter how many people share one IP address.
//   - loginIpLimiter is loose and counts per IP address. It only stops one computer trying
//     many accounts. It is loose because everyone on the ALU campus network can share one IP.
// Register, verify-email and resend each get their own limit too. This way a person who used up
// the login limit is not also blocked from registering or from using their verification link.
//
// More limiters are added in later steps, next to the routes they protect.
//
// In tests the limits are switched off, or other test files would hit 429 errors that have
// nothing to do with what they check. The rate limit tests switch them on with
// RATE_LIMIT_TEST=1. The Jest check stops NODE_ENV=test alone from turning the limits off on
// a real server.
import rateLimit from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const skipInTests = () => process.env.NODE_ENV === 'test'
  && process.env.JEST_WORKER_ID !== undefined
  && process.env.RATE_LIMIT_TEST !== '1';

function respond429(message) {
  return (_req, res) => {
    res.status(429).json({ error: message });
  };
}

// The email the request is about, written the same way every time. If there is no email
// the IP address is used instead.
const emailOrIp = (req) => String(req.body?.email || '').trim().toLowerCase() || req.ip;

const AUTH_MESSAGE = 'Too many attempts. Please wait 15 minutes and try again.';

// POST /auth/login: strict, counted per email.
export const loginEmailLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  // Only failed attempts count. A person's own successful logins must not use up their budget.
  skipSuccessfulRequests: true,
  // A 403 (email not verified) does not count as a failed attempt either. It only happens
  // after the password was right, so it is not password guessing. Counting it would lock out
  // someone who keeps refreshing while they wait for their verification email.
  requestWasSuccessful: (_req, res) => res.statusCode < 400 || res.statusCode === 403,
  keyGenerator: emailOrIp,
  handler: respond429(AUTH_MESSAGE),
});

// POST /auth/login: loose backstop, counted per IP address.
export const loginIpLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: respond429(AUTH_MESSAGE),
});

// POST /auth/register: counted per IP address, with its own budget.
export const registerLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: respond429(AUTH_MESSAGE),
});

// POST /auth/verify-email: counted per IP address. The token cannot be guessed, so this is not
// about guessing. It stops anyone calling the database for free all day. It is loose (100) so a
// group of students verifying together from one campus IP do not block each other.
export const verifyEmailLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: respond429('Too many verification attempts. Please wait 15 minutes and try again.'),
});

const RESEND_MESSAGE = 'Too many verification emails requested. Please wait 15 minutes and try again.';

// POST /auth/resend-verification: strict, counted per email. The risk here is someone filling
// one person's inbox with emails, so the count is per address.
//
// It does not skip successful requests, because this route answers 200 to everything on
// purpose. Skipping them would switch the limit off.
//
// The count uses the email that was typed, never whether an account exists. This way a 429
// does not reveal anything that a 200 would not.
//
// 5 is the middle ground. Lower would let someone use up a victim's budget and stop them
// getting a link they need. Higher makes email bombing worth trying.
export const resendEmailLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  keyGenerator: emailOrIp,
  handler: respond429(RESEND_MESSAGE),
});

// POST /auth/resend-verification: loose backstop per IP address, for one computer cycling
// through many email addresses.
export const resendIpLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: respond429(RESEND_MESSAGE),
});

const FORGOT_MESSAGE = 'Too many password reset emails requested. Please wait 15 minutes and try again.';

// POST /auth/forgot-password: strict, counted per email. It works the same way as resend. The
// risk is someone filling one person's inbox so the count is per address. It does not skip
// successful requests because the route always answers 200. The count uses the email that was
// typed so a 429 does not show which emails have an account.
export const forgotPasswordEmailLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  keyGenerator: emailOrIp,
  handler: respond429(FORGOT_MESSAGE),
});

// POST /auth/forgot-password: loose backstop per IP address. It has its own budget, so using up
// the resend limit never blocks a password reset request.
export const forgotPasswordIpLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: respond429(FORGOT_MESSAGE),
});

// POST /auth/reset-password: counted per IP address. The caller sends a token and no email, so
// there is nothing to count per address. A strict limit would turn into a strict per-IP limit
// and lock out everyone on a shared campus IP. The token cannot be guessed. This limit only stops
// free database and password-hashing work.
export const resetPasswordLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: respond429('Too many password reset attempts. Please wait 15 minutes and try again.'),
});

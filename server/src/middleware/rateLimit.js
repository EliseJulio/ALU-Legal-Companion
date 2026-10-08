// Rate limits. They cap how often one person or one email address, can try something in a
// time window. They slow down password guessing and stop anyone filling an inbox with emails.
//
// Every limiter is made by createLimiter so adding one later is a few lines.
import rateLimit from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// The limits are off while Jest runs. Other tests would meet 429 errors that have nothing
// to do with what they check. The rate limit tests switch them on with RATE_LIMIT_TEST=1.
// The JEST_WORKER_ID check stops NODE_ENV=test alone from switching them off on a real server.
const skipInTests = () => process.env.NODE_ENV === 'test'
  && process.env.JEST_WORKER_ID !== undefined
  && process.env.RATE_LIMIT_TEST !== '1';

export function createLimiter({ windowMs = FIFTEEN_MINUTES, max, message, ...options }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTests,
    handler: (_req, res) => res.status(429).json({ error: message }),
    ...options,
  });
}

// The email a request is about, written the same way every time. With no email the IP is used.
const emailOrIp = (req) => String(req.body?.email || '').trim().toLowerCase() || req.ip;

const AUTH_MESSAGE = 'Too many attempts. Please wait 15 minutes and try again.';

// Login: strict, counted per email. This is the real defence against password guessing.
// Only failed attempts count so a person's own good logins never use up their budget.
// A 403 (email not verified) is not counted either. It only happens after the password was
// right, so it is not guessing.
export const loginEmailLimiter = createLimiter({
  max: 10,
  message: AUTH_MESSAGE,
  keyGenerator: emailOrIp,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode < 400 || res.statusCode === 403,
});

// Routes that send an email (resend a verification link, forgot password): strict, per email.
// The risk is someone filling one person's inbox. These routes always answer 200 on purpose,
// so successful requests count too. The count uses the email that was typed and never whether
// an account exists, so a 429 does not reveal anything a 200 would not.
export const emailLimiter = createLimiter({
  max: 5,
  message: 'Too many emails requested. Please wait 15 minutes and try again.',
  keyGenerator: emailOrIp,
});

// Every auth route: loose, counted per IP. It only stops one computer trying many accounts.
// It is loose because everyone on the ALU campus network can share one IP.
export const authIpLimiter = createLimiter({
  max: 100,
  message: AUTH_MESSAGE,
});

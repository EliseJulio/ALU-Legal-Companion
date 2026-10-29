// Rate limits. They cap how often one person or one email address, can try something in a
// time window. They slow down password guessing and stop anyone filling an inbox with emails.
//
// Every limiter is made by createLimiter so adding one later is a few lines.
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// With no REDIS_URL every limiter keeps express-rate-limit's own in-memory store (fine for one
// instance, which is all this capstone deploys). With REDIS_URL set, counts live in Redis instead,
// so every limit still holds when more than one server process shares the load.
const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
  : null;

if (redisClient) {
  // A rate limiter must never be the reason a request fails. If Redis is unreachable, log it
  // once per error and let express-rate-limit's own in-memory fallback keep the server usable.
  redisClient.on('error', (err) => console.error('[rate-limit] Redis error:', err.message));
}

const redisStore = (prefix) => (redisClient
  ? new RedisStore({ sendCommand: (...args) => redisClient.call(...args), prefix })
  : undefined);

let limiterCount = 0;

// The limits are off while Jest runs. Other tests would meet 429 errors that have nothing
// to do with what they check. The rate limit tests switch them on with RATE_LIMIT_TEST=1.
// The JEST_WORKER_ID check stops NODE_ENV=test alone from switching them off on a real server.
const skipInTests = () => process.env.NODE_ENV === 'test'
  && process.env.JEST_WORKER_ID !== undefined
  && process.env.RATE_LIMIT_TEST !== '1';

export function createLimiter({ windowMs = FIFTEEN_MINUTES, max, message, ...options }) {
  limiterCount += 1;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTests,
    store: redisStore(`rl:${limiterCount}:`),
    handler: (_req, res) => res.status(429).json({ error: message }),
    ...options,
  });
}

// POST /matters/:id/documents. It is counted for the signed-in person and the IP is only the fallback.
// An upload is up to 10 MB held in memory and then encrypted and written to disk. So this limits what
// one account can ask of the server. 60 in 15 minutes is far above real use. A person attaching the
// paperwork for a car uploads about a dozen files. It is counted by account so a shared campus IP
// cannot use up the budget of anyone else.
export const documentUploadLimiter = createLimiter({
  max: 60,
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : req.ip),
  message: 'Too many uploads. Please wait a few minutes and try again.',
});

// GET /search. Open to everyone and it reads three tables, so it has a cap per address. 120 in
// 15 minutes is far above a person typing and stops a script from using the database as a free
// scraper.
export const searchLimiter = createLimiter({
  max: 120,
  message: 'Too many searches. Please wait a few minutes and try again.',
});

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

// Anonymous submissions such as a booking or a question. The limit is per IP and is generous
// because a real anonymous reporter files one or two. It stops someone flooding an expert's
// inbox. Each route calls this to get its own limiter so one route does not use up another's budget.
export const newSubmitLimiter = () => createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Too many submissions. Please wait a while and try again.',
});

// Looking something up by its anonymous token. The token is the only key to the record so
// unlimited guessing would be a risk. The limit is loose because a campus can share one IP.
export const newTokenLookupLimiter = () => createLimiter({
  max: 100,
  message: 'Too many lookups. Please wait 15 minutes and try again.',
});

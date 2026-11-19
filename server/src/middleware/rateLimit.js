// Rate limits. They cap how often one person or one email address, can try something in a
// time window. They slow down password guessing and stop anyone filling an inbox with emails.
//
// Every limiter is made by createLimiter so adding one later is a few lines.
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// With no REDIS_URL every limiter keeps the in-memory store of express-rate-limit. That is fine for one instance.
// With REDIS_URL set the counts live in Redis instead.
// So every limit still holds when more than one server process shares the load.
const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
  : null;

if (redisClient) {
  // A rate limiter must never be the reason a request fails. If Redis is unreachable, log it
  // once per error and let express-rate-limit's own in-memory fallback keep the server usable.
  redisClient.on('error', (err) => console.error('[rate-limit] Redis error:', err?.name, err?.code));
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

// The limiter logs the error it gets. A store error can carry a host or a key, so the error that
// reaches it keeps only its name and its code.
function quietStore(store) {
  return new Proxy(store, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function') return value;
      if (prop !== 'increment') return value.bind(target);
      return async (...args) => {
        try {
          return await value.apply(target, args);
        } catch (err) {
          const code = err?.code ? ` (${err.code})` : '';
          const safe = new Error(`The rate limit store could not be reached${code}.`);
          safe.name = err?.name || 'Error';
          safe.code = err?.code;
          throw safe;
        }
      };
    },
  });
}

// A failing store lets the request through. A rate limiter must never be the reason a request fails.
export function createLimiter({ windowMs = FIFTEEN_MINUTES, max, message, store, ...options }) {
  limiterCount += 1;
  const backing = store ?? redisStore(`rl:${limiterCount}:`);
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTests,
    store: backing ? quietStore(backing) : undefined,
    passOnStoreError: true,
    handler: (_req, res) => res.status(429).json({ error: message }),
    ...options,
  });
}

// POST /matters/:id/documents. It is counted for the signed-in person and the IP is only the fallback.
// An upload is up to 10 MB held in memory, then encrypted and stored in the database. The limit is per
// account, so a shared campus IP cannot use up the budget of anyone else.
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

// Change password: strict, counted per signed-in account. A stolen sign-in could otherwise guess the
// current password with no limit. Only failed attempts count, so a person who gets it right never uses it up.
export const passwordChangeLimiter = createLimiter({
  max: 10,
  message: AUTH_MESSAGE,
  keyGenerator: (req) => `user:${req.user.id}`,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode < 400,
});

// Routes that check the current password of a signed-in account: change email and erase account.
// The same rule as the change-password limit, shared by both routes so they draw on one budget.
export const accountPasswordLimiter = createLimiter({
  max: 10,
  message: AUTH_MESSAGE,
  keyGenerator: (req) => `user:${req.user.id}`,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode < 400,
});

// Routes that send an email to a typed address: strict and per email.
// The risk is someone filling one person's inbox. These routes always answer 200 on purpose so successful requests count too.
// The count uses the email that was typed. It never uses whether an account exists.
// So a 429 does not reveal anything a 200 would not.
// Each route has its own limiter, so requests on one route never use up the budget of another.
const EMAIL_MESSAGE = 'Too many emails requested. Please wait 15 minutes and try again.';
const SLOW_EMAIL_MESSAGE = 'Too many emails requested. Please wait an hour and try again.';
const perEmail = () => createLimiter({ max: 5, message: EMAIL_MESSAGE, keyGenerator: emailOrIp });
export const resendLimiter = perEmail();
export const forgotPasswordLimiter = perEmail();

// Register: counted per typed email, one hour. A person who mistypes once or twice stays well inside it.
export const registerEmailLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: SLOW_EMAIL_MESSAGE,
  keyGenerator: emailOrIp,
});

// Change email: counted per signed-in account and not per typed address, so one account cannot send
// mail to many different addresses and nobody can block another person by naming their address.
// Requests refused with a 4xx do not count because they send nothing.
export const changeEmailLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: SLOW_EMAIL_MESSAGE,
  keyGenerator: (req) => `user:${req.user.id}`,
  skipFailedRequests: true,
});

// POST /api/ask-ai. Each question can cost a model call, so this is kept low per address.
// Five a minute is far above a person reading an answer and stops a script from using up the quota.
export const askAiLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many questions. Please wait a minute and try again.',
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

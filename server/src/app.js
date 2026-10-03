// Express app setup. Kept apart from index.js so tests can use it without opening a port.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
// Lets an error inside an async route reach the error handler below. Without it, the
// request hangs. Import it before the routes.
import 'express-async-errors';
import authRoutes from './routes/auth.js';
import guideRoutes from './routes/guides.js';
import directoryRoutes from './routes/directory.js';
import matterRoutes from './routes/matters.js';
import questionRoutes from './routes/questions.js';
import bookmarkRoutes from './routes/bookmarks.js';
import adminRoutes from './routes/admin.js';
import miscRoutes from './routes/misc.js';

dotenv.config();

const app = express();

// Behind a reverse proxy, set TRUST_PROXY to the number of proxies (usually 1) so req.ip is the
// real client. It is off by default: switched on without a proxy, anyone could fake their IP
// with an X-Forwarded-For header and get around the rate limits.
const TRUST_PROXY = process.env.TRUST_PROXY;
if (/^\d+$/.test(TRUST_PROXY || '')) {
  app.set('trust proxy', Number(TRUST_PROXY));
} else if (/^true$/i.test(TRUST_PROXY || '')) {
  app.set('trust proxy', true);
}

// First, so every response gets the security headers.
app.use(helmet());

// Browsers may only call this API from the origins listed in CORS_ORIGINS (comma-separated).
// Requests without an Origin header like curl or health checks are not affected.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (CORS_ORIGINS.length === 0) {
  CORS_ORIGINS.push('http://localhost:5173');
  console.warn('CORS_ORIGINS not set, using http://localhost:5173 (the Vite dev server).');
}

// The rate-limit headers are exposed so a browser app can read when it may retry.
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: false,
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
}));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/directory', directoryRoutes);
app.use('/api/matters', matterRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', miscRoutes);

// Anything no route matched. Must come after all routes. Keeps the "every error is
// { error: message }" promise, instead of Express's default HTML page.
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Last stop for errors. Clients never see stack traces, SQL or file paths.
app.use((err, req, res, _next) => {
  // Log a short summary not the error itself: database errors can contain the value
  // that caused them (an anonymous token for example) and that must not reach the logs.
  console.error('[error]', {
    method: req.method,
    path: req.path,
    name: err.name,
    code: err.code,
    constraint: err.constraint,
    status: err.status ?? err.statusCode,
  });
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That request is too large.' });
  }
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

export default app;

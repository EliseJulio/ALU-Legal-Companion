// Kept apart from index.js so tests can use the app
// with Supertest without opening a port.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
// Without this an error inside an async route crashes the process. With it the error
// reaches the handler at the bottom of this file. It must come before the routes are
// imported because it only patches routers that are made after it runs.
import 'express-async-errors';
import authRoutes from './routes/auth.js';
import directoryRoutes from './routes/directory.js';
import matterRouteRoutes from './routes/matterRoutes.js';
import contactRoutes from './routes/contacts.js';
import bookingRoutes from './routes/bookings.js';

dotenv.config();

const app = express();

// Trust proxy is off unless TRUST_PROXY says otherwise. Turn it on only behind a real
// reverse proxy. If it is on and a client reaches the server directly, that client can fake
// its IP address with a header and dodge every IP rate limit.
// Use a number of proxies (usually 1) or true/false.
const TRUST_PROXY = process.env.TRUST_PROXY;
if (/^\d+$/.test(TRUST_PROXY || '')) {
  app.set('trust proxy', Number(TRUST_PROXY));
} else if (/^true$/i.test(TRUST_PROXY || '')) {
  app.set('trust proxy', true);
} else if (/^false$/i.test(TRUST_PROXY || '')) {
  app.set('trust proxy', false);
}

// First, so the security headers are on every response.
app.use(helmet());

// The browser addresses allowed to call this API. CORS_ORIGINS is a comma-separated list.
// Requests with no Origin header (curl, health checks) are not affected by CORS.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (CORS_ORIGINS.length === 0) {
  CORS_ORIGINS.push('http://localhost:5173');
  console.warn('CORS_ORIGINS is not set. Using http://localhost:5173 (the Vite dev server).');
}

// The rate limit headers are exposed so a browser can read when it may try again.
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: false,
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
}));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/directory', directoryRoutes);
app.use('/api/directory', matterRouteRoutes);
app.use('/api/emergency-contacts', contactRoutes);
app.use('/api/bookings', bookingRoutes);

// A path nothing matched. Every error from this API is { error: "message" }, even for a typo.
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// The one place errors end up. No stack trace, SQL or file path reaches the client.
app.use((err, req, res, _next) => {
  // Log a short summary and never the error itself. A database error can contain the value
  // a person typed, such as an anonymous token.
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

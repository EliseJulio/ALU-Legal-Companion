// ALU Legal Companion API server entry point
import app from './app.js';
import { getSecret } from './middleware/auth.js';
import { isRealTransport } from './services/mailer.js';

// Stop at startup if JWT_SECRET is missing or weak. Otherwise anyone could make their own admin token.
try {
  getSecret();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

// Say in one line when mail is in dev mode, so nobody has to guess whether a link was sent.
const notes = [
  isRealTransport() ? null : 'mail in dev mode: no SMTP_URL, links are printed to this log',
].filter(Boolean);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`ALU Legal Companion API on :${port}${notes.length ? ` (${notes.join('; ')})` : ''}`));

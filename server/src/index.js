// ALU Legal Companion API: server entry point
import app from './app.js';
import { getSecret } from './middleware/auth.js';

// Stop at startup if JWT_SECRET is missing or weak. This is better than failing at the first login.
try {
  getSecret();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`ALU Legal Companion API on :${port}`));

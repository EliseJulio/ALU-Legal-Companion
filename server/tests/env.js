// Runs before any test file is loaded, so db.js connects to the test database.
// dotenv never overrides a variable that is already set, so this wins over server/.env.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgres://alu:alu_dev@localhost:5432/alu_legal_test';
// An obviously fake secret for the tests. It must be at least 32 characters to pass getSecret().
process.env.JWT_SECRET = 'test-only-jwt-secret-not-for-production';
// The tests must never send a real email. This is set to an empty string and not deleted.
// dotenv fills in a variable that is missing, so a developer with a real SMTP_URL in
// server/.env would get a real mail transport during the tests.
process.env.SMTP_URL = '';

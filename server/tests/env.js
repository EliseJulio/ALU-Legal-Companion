// Runs before every test file, so the app sees these values when it loads.
// dotenv does not replace a variable that is already set so these win over server/.env.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgres://alu:alu_dev@localhost:5432/alu_legal_test';
process.env.CORS_ORIGINS = 'http://localhost:5173';
// A fake secret, 64 characters long so getSecret accepts it. It is not a real secret.
process.env.JWT_SECRET = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

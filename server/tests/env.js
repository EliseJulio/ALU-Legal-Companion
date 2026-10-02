// Runs before every test file so the app reads these values when it loads.
// dotenv never overrides a variable that is already set so these win over server/.env.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgres://alu:alu_dev@localhost:5432/alu_legal_test';
process.env.CORS_ORIGINS = 'http://localhost:5173';

// Test runner settings. The sources are ESM so Jest runs them as they are (no Babel).
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  // env.js runs before any test file loads so db.js connects to the test database.
  setupFiles: ['<rootDir>/tests/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Each run gets its own schema. See tests/globalSetup.js for why.
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  // The tests share one database so they run one file at a time.
  maxWorkers: 1,
  // Hide the app's own console output. It can bury a real failure in noise.
  // Use npm test -- --silent=false to see it again.
  silent: true,
  // Password hashing runs at full cost in the tests and takes a few hundred
  // milliseconds each time. The default of 5 seconds is too tight on a slow machine.
  testTimeout: 20000,
};

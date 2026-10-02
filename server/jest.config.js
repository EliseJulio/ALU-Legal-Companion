// Test runner config. The code uses ES modules, so Jest runs it as it is, with no transpile step.
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  // Sets the environment before any test file loads the app.
  setupFiles: ['<rootDir>/tests/env.js'],
  // Tests share one database server so they must not run concurrently.
  maxWorkers: 1,
};

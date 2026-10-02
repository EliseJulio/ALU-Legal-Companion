// Test runner settings. The code uses ES modules so Jest runs it as it is.
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  // Sets up the environment before any test file loads the app.
  setupFiles: ['<rootDir>/tests/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Make a private schema for each run and remove it at the end.
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  // The tests hash passwords at full strength, which is slow so allow more than 5 seconds.
  testTimeout: 20000,
  // The tests share one database so they must not run at the same time.
  maxWorkers: 1,
};

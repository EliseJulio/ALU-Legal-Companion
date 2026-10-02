// Test runner config. The code uses ES modules, so Jest runs it as it is, with no transpile step.
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  // Tests share one database server so they must not run concurrently.
  maxWorkers: 1,
};

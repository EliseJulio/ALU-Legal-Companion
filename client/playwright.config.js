import { defineConfig } from '@playwright/test';

// Browser tests. They run the real pages in a real browser at the width of a phone. The API is
// replaced in each test by fixed replies (see tests/e2e/support.js). So no server and no
// database is needed. A test cannot change anyone's data.
//
// E2E_BASE_URL points the tests at a dev server that is already running, for example
// E2E_BASE_URL=http://localhost:5200. When it is set no server is started and none is reused,
// so a different app already on the default port cannot answer the tests.
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  // The first page after the dev server starts is slow because it builds the code on demand.
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: [['list']],
  use: {
    baseURL,
    // A phone. Most students will use the site on one.
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  },
  // Starts the page if it is not already running. Skipped when the tests point at a running server.
  webServer: external
    ? undefined
    : {
      command: 'npx vite --host localhost',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120000,
    },
});

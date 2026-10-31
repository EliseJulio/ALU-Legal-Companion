import { defineConfig } from '@playwright/test';

// Takes the pictures that go in the documentation (docs1/screenshots). It is a separate config so
// a normal "npm run e2e" does not make pictures. Run it with "npm run screenshots". The pages
// are real. The data is the same fake data the browser tests use. Nothing here is a real person.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.shots.js',
  workers: 1,
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'npx vite --host localhost',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
});

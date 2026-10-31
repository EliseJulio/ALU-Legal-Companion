import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { blockAriaDisabledClicks } from '../src/lib/ariaDisabled';

// The app installs this once. Tests need the same behaviour.
blockAriaDisabledClicks();

// A unit test must never reach the network. If a page calls the API without a mock the test
// would otherwise send a real request to a developer's own server and could create accounts or
// bookings in their database. It would also behave differently when the server is up.
// api.js turns any throw from fetch into an ApiError, so the failure shows up in the test as a
// missing result. The message below says why a request was tried at all.
// api.test.js sets its own fetch after this runs, so it keeps control of what it tests.
beforeEach(() => {
  global.fetch = (...args) => {
    console.error(
      '[test setup] Unmocked network call:',
      String(args[0]),
      '\n  Give the test a mock for global.fetch.',
    );
    throw new Error('Unmocked network call in a unit test');
  };
});

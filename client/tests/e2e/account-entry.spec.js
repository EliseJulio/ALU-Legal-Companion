import { test, expect } from '@playwright/test';
import { stubApi, reply, DATA, scrollsSideways } from './support.js';

// Sprint 8: the account entry pages and the anonymous code check pages, at the four widths.

const common = { 'GET /emergency-contacts': () => DATA.contacts };
const PAGES = [
  ['/login', 'Sign in'],
  ['/register', 'Create an ALU account'],
  ['/forgot-password', 'Forgot your password?'],
  ['/reset-password?token=abc', 'Choose a new password'],
  ['/redeem-invite?token=abc', 'Accept your invitation'],
  ['/ask/check', 'Check for your answer'],
  ['/directory/booking-check', 'Check your booking'],
];

for (const width of [320, 390, 834, 1440]) {
  test(`the account entry and code check pages do not scroll sideways at ${width} px`, async ({ page }) => {
    // Seven pages in one test. The dev server compiles each on first use, so give it room.
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await stubApi(page, common);
    for (const [path, heading] of PAGES) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      expect(await scrollsSideways(page), path).toBe(false);
    }
  });
}

test('Show password is a real 44 px tick box that reveals the box and keeps focus on itself', async ({ page }) => {
  await stubApi(page, common);
  await page.goto('/redeem-invite?token=abc');
  const toggle = page.getByRole('checkbox', { name: /^Show password/ });
  const row = await toggle.locator('xpath=ancestor::label').boundingBox();
  expect(row.height).toBeGreaterThanOrEqual(43.5);
  await page.getByLabel('Password', { exact: true }).fill('a long secret');
  await toggle.check();
  await expect(toggle).toBeFocused();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await expect(page.getByLabel('Confirm password')).toHaveAttribute('type', 'text');
  await expect(toggle).toBeChecked();
});

test('pressing Show password never sends the form', async ({ page }) => {
  const api = await stubApi(page, common);
  await page.goto('/login');
  await page.getByRole('checkbox', { name: /^Show password/ }).check();
  expect(api.sent('POST', '/auth/login')).toHaveLength(0);
  await expect(page).toHaveURL(/\/login$/);
});

test('every account entry page keeps the password note and one Emergency numbers link', async ({ page }) => {
  await stubApi(page, common);
  for (const [path] of PAGES.slice(1, 5)) {
    await page.goto(path);
    await expect(page.getByText('Keep your password private.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Emergency help remains available' })).toHaveAttribute('href', '/emergency');
    await expect(page.getByRole('link', { name: 'Emergency numbers' })).toHaveCount(1);
  }
});

test('a waiting question can be checked again and points to emergency help', async ({ page }) => {
  let calls = 0;
  await stubApi(page, {
    ...common,
    'GET /questions/anon/:code': () => {
      calls += 1;
      return calls === 1
        ? { id: 1, text: 'Can my landlord keep my deposit?', answer: null, status: 'open' }
        : { id: 1, text: 'Can my landlord keep my deposit?', answer: 'Write to the landlord first.', status: 'answered' };
    },
  });
  await page.goto('/ask/check');
  await page.getByLabel('Your question code').fill(DATA.code);
  await page.getByRole('button', { name: 'Check for answer' }).click();
  await expect(page.getByRole('heading', { name: 'Awaiting a response' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Emergency help →' })).toHaveAttribute('href', '/emergency');
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByText('Write to the landlord first.')).toBeVisible();
  // The code was sent in the path of the request only. It is not in the address bar.
  expect(page.url()).not.toContain(DATA.code);
});

test('a code that matches nothing says what to try next without telling anyone anything', async ({ page }) => {
  await stubApi(page, { ...common, 'GET /questions/anon/:code': () => reply({ error: 'No matching request' }, 404) });
  await page.goto('/ask/check');
  await page.getByLabel('Your question code').fill('0000-0000-0000-0000');
  await page.getByRole('button', { name: 'Check for answer' }).click();
  await expect(page.getByRole('alert')).toHaveText('No matching request');
  await expect(page.getByText(/Signing in will not add this request to your account/)).toBeVisible();
});

import { test, expect } from '@playwright/test';
import { stubApi, signInAs, DATA } from './support.js';

// Recommendation and tracking: say what happened, see where it goes first, then keep track of it.

const routeApi = {
  'GET /directory/routes': ({ query }) => (query.get('q') ? [DATA.routeCards[0]] : DATA.routeCards),
  'GET /directory/routes/:id': () => DATA.route(),
};

test('a visitor finds where a matter goes first and sees the law, the steps and the deadline', async ({ page }) => {
  const api = await stubApi(page, routeApi);
  await page.goto('/where-to-go');

  await page.getByLabel('Describe your issue').fill('landlord deposit');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect.poll(() => api.calls.some((c) => c.path === '/directory/routes' && c.query.get('q') === 'landlord deposit')).toBe(true);

  await page.getByRole('link', { name: /My landlord kept my deposit/ }).click();
  await expect(page).toHaveURL(/\/where-to-go\/1$/);
  await expect(page.getByRole('heading', { name: 'Go here first' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Example Abunzi Committee' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Why this destination?' })).toBeVisible();
  await expect(page.getByText(/Abunzi committees hear contract disputes/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Deadline' })).toBeVisible();
  await expect(page.getByText('30 days', { exact: true })).toBeVisible();
  await expect(page.getByText('Go to the committee')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources & review' })).toBeVisible();
});

test('a visitor is offered a sign in and not a tracking button', async ({ page }) => {
  await stubApi(page, routeApi);
  await page.goto('/where-to-go/1');
  await expect(page.getByRole('link', { name: 'Track this matter' })).toHaveCount(0);
  // The side navigation has a Sign in link too. The page one is scoped to main.
  await expect(page.getByRole('main').getByRole('link', { name: 'Sign in to start tracking' })).toHaveAttribute('href', '/login?next=%2Fmatters%2Fnew%3Froute%3D1');
});

test('a student tracks a matter from a route and sees the deadline and reminders', async ({ page }) => {
  await signInAs(page, 'student');
  const api = await stubApi(page, {
    ...routeApi,
    'POST /matters': () => ({ id: 7 }),
    'GET /matters/:id': () => DATA.matter(),
    'GET /matters/share-targets': () => [],
  });

  await page.goto('/where-to-go/1');
  await page.getByRole('link', { name: 'Track this matter' }).click();
  await expect(page).toHaveURL(/\/matters\/new\?route=1$/);

  await page.getByLabel(/When was the day you left/).fill('2026-09-01');
  await page.getByRole('button', { name: 'Create private matter' }).click();

  await expect(page).toHaveURL(/\/matters\/7$/);
  // The page sends only the day the clock started. The server works out the deadline.
  expect(api.sent('POST', '/matters')[0].body).toEqual({ route_id: 1, deadline_start: '2026-09-01' });
  await expect(page.getByRole('heading', { level: 1, name: 'My landlord kept my deposit' })).toBeVisible();
  await expect(page.getByText(/Deadline:/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible();
  await expect(page.getByText(/Scheduled/).first()).toBeVisible();
});

test('a student can share a matter with a lawyer and stop sharing', async ({ page }) => {
  await signInAs(page, 'student');
  let sharedWith = null;
  const api = await stubApi(page, {
    'GET /matters/:id': () => DATA.matter({ shared_with: sharedWith ? 9 : null, shared_with_name: sharedWith }),
    'GET /matters/share-targets': () => [{ id: 9, name: 'Example Pro Bono Lawyer' }],
    'POST /matters/:id/share': () => { sharedWith = 'Example Pro Bono Lawyer'; return {}; },
    'DELETE /matters/:id/share': () => { sharedWith = null; return {}; },
  });

  await page.goto('/matters/7');
  await page.getByLabel('Share with', { exact: true }).selectOption('9');
  await page.getByRole('button', { name: 'Share this matter' }).click();
  await expect(page.getByText(/cannot see your name or email/)).toBeVisible();
  expect(api.sent('POST', '/matters/7/share')[0].body).toEqual({ provider_id: 9 });

  await page.getByRole('button', { name: 'Revoke expert access' }).click();
  await expect(page.getByRole('button', { name: 'Share this matter' })).toBeVisible();
});

test('deleting a matter asks first', async ({ page }) => {
  await signInAs(page, 'student');
  const api = await stubApi(page, {
    'GET /matters/:id': () => DATA.matter(),
    'GET /matters/share-targets': () => [],
    'DELETE /matters/:id': () => ({ __reply: true, status: 204 }),
    'GET /matters': () => [],
  });
  await page.goto('/matters/7');
  await page.getByRole('button', { name: 'Delete matter…' }).click();
  await page.getByRole('button', { name: 'Keep matter' }).click();
  expect(api.sent('DELETE', '/matters/7')).toHaveLength(0);

  await page.getByRole('button', { name: 'Delete matter…' }).click();
  await page.getByRole('button', { name: 'Permanently delete matter' }).click();
  await expect(page).toHaveURL(/\/matters$/);
  expect(api.sent('DELETE', '/matters/7')).toHaveLength(1);
});

test('a visitor who opens My matters is asked to sign in and nothing is requested', async ({ page }) => {
  const api = await stubApi(page, {});
  await page.goto('/matters');
  await expect(page.getByText('Sign in to track a matter')).toBeVisible();
  expect(api.calls).toHaveLength(0);
});

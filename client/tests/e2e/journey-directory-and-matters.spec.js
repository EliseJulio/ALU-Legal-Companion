import { test, expect } from '@playwright/test';
import { stubApi, signInAs, DATA } from './support.js';

// Where a matter goes first, and keeping track of it.

const ROUTES = [{ ...DATA.routeCards[0], area: 'tenancy' }, { ...DATA.routeCards[1], area: 'employment' }];
const api = {
  'GET /directory/routes': () => ROUTES,
  'GET /directory/routes/:id': () => DATA.route(),
  'GET /directory/ladder': () => [],
};

test('a visitor answers two questions and is told which office a deposit problem goes to first', async ({ page }) => {
  await stubApi(page, api);
  await page.goto('/directory');
  const card = page.getByRole('region', { name: 'Not sure where your matter goes?' });
  await card.getByRole('button', { name: 'Answer two questions' }).click();
  await card.getByRole('button', { name: 'Renting', exact: true }).click();
  await card.getByRole('button', { name: 'My landlord kept my deposit' }).click();
  await card.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/directory\?route=1$/);
  await expect(card.getByText('Example Abunzi Committee').first()).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Deadline', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Sign in to start tracking' })).toBeVisible();
});

test('a student goes from the answer to tracking the matter', async ({ page }) => {
  await signInAs(page, 'student');
  await stubApi(page, api);
  await page.goto('/directory?route=1');
  await page.getByRole('link', { name: 'Track this matter' }).click();
  await expect(page).toHaveURL(/\/matters\/new\?route=1$/);
});

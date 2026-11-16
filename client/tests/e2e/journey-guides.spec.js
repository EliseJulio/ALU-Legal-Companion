import { test, expect } from '@playwright/test';
import { stubApi, DATA } from './support.js';

// Reading a published guide.

test('a visitor finds a published guide, reads it, and sees that it is information and not advice', async ({ page }) => {
  await stubApi(page, {
    'GET /guides': () => [DATA.guide()],
    'GET /guides/:id': () => DATA.guide(),
    'GET /emergency-contacts': () => DATA.contacts,
  });
  await page.goto('/guides');
  await page.getByRole('link', { name: /Getting your deposit back/ }).first().click();

  await expect(page).toHaveURL(/\/guides\/1$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Getting your deposit back' })).toBeVisible();
  await expect(page.getByText('A lease is a contract.').first()).toBeVisible();
  await expect(page.getByText(/Legal information/).first()).toBeVisible();
});

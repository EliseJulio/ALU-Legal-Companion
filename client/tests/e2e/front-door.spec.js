import { test, expect } from '@playwright/test';
import { stubApi, DATA, scrollsSideways, openMenu } from './support.js';

// The pages anyone can open. These checks come first because a person in trouble reaches them
// first, often on a phone and often in a hurry.

test.beforeEach(async ({ page }) => {
  await stubApi(page, {
    'GET /emergency-contacts': () => DATA.contacts,
    'GET /directory/routes': () => DATA.routeCards,
    'GET /directory/routes/:id': () => DATA.route(),
    'GET /directory/providers': () => [DATA.provider()],
    'GET /guides': () => [DATA.guide()],
  });
});

test('the front door leads with where to go and what the platform is for', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Understand your issue/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Find Where to Go' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Legal Guides' })).toBeVisible();
  // One card for each of the six subjects the guides cover.
  for (const subject of ['Renting', 'Work', 'Business', 'Immigration', 'Harassment', 'Cars and driving']) {
    await expect(page.getByRole('link', { name: `Explore ${subject}` })).toBeVisible();
  }
  // The bands run from the top of the page to the bottom.
  for (const name of ['Everyday questions. A more informed start.', 'Not sure which office to approach?', 'Read for your situation, not a law number.', 'Trust is a visible record.', 'A good next step starts with a clearer question.']) {
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
});

test('nothing on the front door mentions an assistant or AI', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/\bAI\b|assistant|chatbot/i);
});

test('the emergency numbers link is reached before the menu by keyboard', async ({ page }) => {
  await page.goto('/');
  const list = page.getByRole('navigation', { name: 'Main' });
  // The skip link, the logo, the emergency link and then the Menu button.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /Legal Companion/ }).first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Emergency numbers' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
  // The menu is closed on a phone, so its links are not in the tab order. Opened, focus goes to
  // the first link.
  await expect(list.getByRole('link', { name: 'Where to Go' })).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(list.getByRole('link', { name: 'Where to Go' })).toBeFocused();
});

test('the emergency numbers link opens the urgent help page with numbers that can be tapped', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Emergency numbers' }).click();
  await expect(page).toHaveURL(/\/emergency$/);
  await expect(page.getByRole('link', { name: /3029/ }).first()).toHaveAttribute('href', 'tel:3029');
  await expect(page.getByRole('link', { name: /112/ }).first()).toHaveAttribute('href', 'tel:112');
});

test('the urgent numbers are still there when the server is down', async ({ page }) => {
  await page.unroute('**/api/**');
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/emergency');
  await expect(page.getByRole('link', { name: /3029/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /112/ }).first()).toBeVisible();
});

test('the disclaimer is in the footer of every page', async ({ page }) => {
  for (const path of ['/', '/where-to-go', '/directory', '/guides', '/ask', '/emergency']) {
    await page.goto(path);
    await expect(page.getByRole('contentinfo')).toContainText('Legal information not legal advice.');
  }
});

test('no page makes a phone scroll sideways', async ({ page }) => {
  for (const path of ['/', '/where-to-go', '/directory', '/guides', '/ask', '/emergency', '/login', '/register']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await scrollsSideways(page), `${path} is wider than the screen`).toBe(false);
  }
});

test('every link and button in the header is at least 44 pixels high', async ({ page }) => {
  await page.goto('/');
  await openMenu(page);
  const targets = page.locator('header a, header button');
  const count = await targets.count();
  expect(count).toBeGreaterThan(4);
  let measured = 0;
  for (let i = 0; i < count; i += 1) {
    // The Narrow and Hide buttons exist only on a wide screen. A control that is not on the screen
    // has no size to measure.
    if (!(await targets.nth(i).isVisible())) continue;
    const box = await targets.nth(i).boundingBox();
    const name = await targets.nth(i).innerText();
    expect(box.height, `"${name.trim()}" is too short`).toBeGreaterThanOrEqual(43.5);
    measured += 1;
  }
  expect(measured).toBeGreaterThan(4);
});

test('an unknown address says so and leads home', async ({ page }) => {
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Go to the home page' }).click();
  await expect(page).toHaveURL(/\/$/);
});

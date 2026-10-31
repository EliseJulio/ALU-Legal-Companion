import { test, expect } from '@playwright/test';
import { stubApi, reply, DATA } from './support.js';

// The last pass. Each check here was found by looking at the real page, not by reading code.

test.beforeEach(async ({ page }) => {
  await stubApi(page, {
    'GET /emergency-contacts': () => DATA.contacts,
    'GET /directory/routes': () => DATA.routeCards,
    'GET /directory/routes/:id': () => DATA.route(),
    'GET /directory/providers': () => [DATA.provider()],
    'GET /guides': () => [DATA.guide()],
    'GET /guides/:id': () => DATA.guide(),
    'POST /auth/login': () => reply({ token: 'tok-test', user: { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' } }),
  });
});

for (const width of [360, 390, 430]) {
  test(`the phone top bar stays on one row at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const brand = await page.getByRole('link', { name: /ALU Legal Companion/ }).first().boundingBox();
    const emergency = await page.getByRole('link', { name: 'Emergency numbers' }).first().boundingBox();
    expect(Math.abs((brand.y + brand.height / 2) - (emergency.y + emergency.height / 2))).toBeLessThan(30);
    expect(emergency.x + emergency.width).toBeLessThanOrEqual(width);
  });
}

test('a page that does not exist leads somewhere', async ({ page }) => {
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Go to the home page' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('signing in returns a person to the page they were on', async ({ page }) => {
  await page.goto('/login?next=%2Fguides%2F1');
  await page.getByLabel('Email').fill('test.student@alustudent.com');
  await page.getByLabel('Password', { exact: true }).fill('a-long-test-password');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await expect(page).toHaveURL(/\/guides\/1$/);
});

test('a next address on another site is ignored', async ({ page }) => {
  await page.goto('/login?next=https%3A%2F%2Fevil.example%2Fx');
  await page.getByLabel('Email').fill('test.student@alustudent.com');
  await page.getByLabel('Password', { exact: true }).fill('a-long-test-password');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await expect(page).not.toHaveURL(/evil\.example/);
});

test('in the dark theme the focus ring offset is the page colour, not white', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('alc.theme', 'dark'));
  await page.goto('/login');
  const ringOffset = await page.evaluate(() => {
    const probe = document.createElement('button');
    probe.className = 'ring-2 ring-offset-2';
    document.body.append(probe);
    const colour = getComputedStyle(probe).getPropertyValue('--tw-ring-offset-color').trim();
    probe.remove();
    return colour;
  });
  expect(ringOffset.toLowerCase()).not.toMatch(/^(#fff|#ffffff|rgb\(255, 255, 255\))$/);
});

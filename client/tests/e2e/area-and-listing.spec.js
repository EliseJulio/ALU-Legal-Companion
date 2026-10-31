import { test, expect } from '@playwright/test';
import { stubApi, reply, DATA, scrollsSideways } from './support.js';
import { DOMAINS } from '../../src/lib/directory.js';

// The area chips on Where to Go, the summary on a guide card and the full listing page.

test('Where to Go chips send the area to the server and show the matching matters', async ({ page }) => {
  const api = await stubApi(page, {
    'GET /directory/routes': ({ query }) => (query.get('area') === 'tenancy'
      ? [{ ...DATA.routeCards[0], area: 'tenancy' }]
      : DATA.routeCards),
  });
  await page.goto('/where-to-go');
  await expect(page.getByRole('link', { name: /Read route and next steps for I was dismissed from work/ })).toBeVisible();
  await page.getByRole('button', { name: 'Renting', exact: true }).click();
  await expect.poll(() => api.calls.some((c) => c.path === '/directory/routes' && c.query.get('area') === 'tenancy')).toBe(true);
  await expect(page.getByRole('button', { name: 'Renting' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: /Read route and next steps for My landlord kept my deposit/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Read route and next steps for I was dismissed from work/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByRole('link', { name: /Read route and next steps for I was dismissed from work/ })).toBeVisible();
});

test('a link can open Where to Go on one area', async ({ page }) => {
  const api = await stubApi(page, { 'GET /directory/routes': () => DATA.routeCards });
  await page.goto('/where-to-go?area=employment');
  await expect(page.getByRole('button', { name: 'Work', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => api.calls.some((c) => c.path === '/directory/routes' && c.query.get('area') === 'employment')).toBe(true);
});

test('a guide card shows its summary', async ({ page }) => {
  await stubApi(page, {
    'GET /guides': () => [{ ...DATA.guide(), summary: 'How to get a deposit back.' }],
  });
  await page.goto('/guides');
  await expect(page.getByText('How to get a deposit back.')).toBeVisible();
});

test('a directory name opens the full listing and the booking link leads on', async ({ page }) => {
  await stubApi(page, {
    'GET /directory/providers': () => [DATA.provider({ id: 1 })],
    'GET /directory/providers/:id': () => DATA.provider({ id: 1 }),
  });
  await page.goto('/directory');
  await page.getByRole('link', { name: 'Example Pro Bono Lawyer', exact: true }).click();
  await expect(page).toHaveURL(/\/directory\/1$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Example Pro Bono Lawyer' })).toBeVisible();
  expect(await scrollsSideways(page)).toBe(false);
  await page.getByRole('link', { name: 'Request consultation' }).click();
  await expect(page).toHaveURL(/\/directory\/book\/1$/);
});

test('the listing route does not swallow the booking pages', async ({ page }) => {
  await stubApi(page, {});
  await page.goto('/directory/booking-check');
  await expect(page.getByRole('heading', { level: 1, name: 'Check your booking' })).toBeVisible();
  await page.goto('/directory/book/1');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Request a consultation');
});

test('a listing that is not published says so and leads back', async ({ page }) => {
  await stubApi(page, {
    'GET /directory/providers/:id': () => reply({ error: 'That listing is not in the directory' }, 404),
  });
  await page.goto('/directory/99');
  await expect(page.getByText('That listing is not in the directory')).toBeVisible();
  await page.getByRole('link', { name: 'Back to the directory' }).click();
  await expect(page).toHaveURL(/\/directory$/);
});

test('on a phone the area chips are an equal two-column grid under a visible label', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await stubApi(page, { 'GET /directory/routes': () => DATA.routeCards });
  await page.goto('/where-to-go');
  await expect(page.getByText('Filter by issue')).toBeVisible();
  const chips = page.getByRole('group', { name: 'Filter by issue' }).getByRole('button');
  await expect(chips).toHaveCount(DOMAINS.length + 1);
  const boxes = await chips.evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
  }));
  expect(new Set(boxes.map((b) => b.left)).size).toBe(2);
  const widths = boxes.map((b) => b.width);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  boxes.forEach((b) => expect(b.height).toBeGreaterThanOrEqual(44));
});

test('the help beside the results is a bordered card on a desktop and plain on a phone', async ({ page }) => {
  await stubApi(page, { 'GET /directory/routes': () => DATA.routeCards });
  const border = () => page.getByRole('complementary').filter({ hasText: 'Search in your own words' })
    .evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/where-to-go');
  await expect.poll(border).toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 800 });
  await expect.poll(border).toBe(0);
});

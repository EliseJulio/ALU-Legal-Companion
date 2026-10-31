import { test, expect } from '@playwright/test';
import { stubApi, DATA, openMenu, scrollsSideways } from './support.js';

// Search from the menu, from the Home card and on the results page, at the three Figma widths.

const GUIDE = { id: 1, title: 'Getting your deposit back', summary: 'How to ask for it.', domain: 'tenancy', source_law: 'Law No. 00/0000' };
const ROUTE = { id: 1, title: 'My landlord kept my deposit', first_forum_name: 'Example Abunzi Committee' };
const PROVIDER = { id: 1, name: 'Kigali Tenancy Clinic', type: 'legal_aid', location: 'Kigali', services: 'Advice on rent.' };

const stub = (page, results = { guides: [GUIDE], routes: [ROUTE], providers: [PROVIDER] }) => stubApi(page, {
  'GET /emergency-contacts': () => DATA.contacts,
  'GET /directory/routes': () => [],
  'GET /guides': () => [],
  'GET /search': ({ query }) => ({
    query: query.get('q'),
    results: Object.fromEntries(Object.entries(results).filter(([key]) => ['all', key].includes(query.get('library')))),
  }),
});

test('a visitor searches from the menu on a desktop and opens a guide', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const api = await stub(page);
  await page.goto('/');
  await page.getByRole('search', { name: 'Site search' }).getByRole('searchbox').fill('landlord deposit');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=landlord\+deposit$/);
  await expect(page.getByRole('link', { name: 'Getting your deposit back' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My landlord kept my deposit' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kigali Tenancy Clinic' })).toBeVisible();
  await expect.poll(() => api.calls.some((c) => c.path === '/search' && c.query.get('q') === 'landlord deposit' && c.query.get('library') === 'all')).toBe(true);
  await page.getByRole('link', { name: 'Getting your deposit back' }).click();
  await expect(page).toHaveURL(/\/guides\/1$/);
});

test('on a phone the search is in the open menu and the menu closes after a search', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await stub(page);
  await page.goto('/');
  await expect(page.getByRole('search', { name: 'Site search' }).getByRole('searchbox')).toBeHidden();
  await openMenu(page);
  await page.getByRole('search', { name: 'Site search' }).getByRole('searchbox').fill('deposit');
  await page.getByRole('search', { name: 'Site search' }).getByRole('button', { name: 'Search the site' }).click();
  await expect(page).toHaveURL(/\/search\?q=deposit$/);
  await expect(page.getByRole('link', { name: 'Getting your deposit back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute('aria-expanded', 'false');
  expect(await scrollsSideways(page)).toBe(false);
});

test('the Home card leads to search on a tablet and is not there on a desktop', async ({ page }) => {
  await stub(page);
  await page.setViewportSize({ width: 834, height: 1000 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Choose where to search' }).click();
  await expect(page).toHaveURL(/\/search$/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Choose where to search' })).toBeHidden();
});

test('a library can be chosen on the results page and the address keeps both choices', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const api = await stub(page);
  await page.goto('/search?q=deposit');
  await page.getByLabel('Where to search').selectOption('guides');
  await page.getByRole('search', { name: 'Search results' }).getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=deposit&library=guides$/);
  await expect(page.getByRole('link', { name: 'Getting your deposit back' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kigali Tenancy Clinic' })).toHaveCount(0);
  await expect.poll(() => api.calls.some((c) => c.path === '/search' && c.query.get('library') === 'guides')).toBe(true);
});

test('nothing found says so in words and leads on', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await stub(page, { guides: [], routes: [], providers: [] });
  await page.goto('/search?q=zzzz');
  await expect(page.getByText('Nothing matches “zzzz”')).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Ask a legal expert' }).click();
  await expect(page).toHaveURL(/\/ask$/);
});

test('the narrow menu has a Search link that opens the page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('alc.sidebar', 'collapsed'));
  await stub(page);
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Search the site' });
  await expect(link).toBeVisible();
  const box = await link.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  await link.click();
  await expect(page).toHaveURL(/\/search$/);
});

for (const width of [320, 390, 834, 1440]) {
  test(`the results page does not scroll sideways at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await stub(page);
    await page.goto('/search?q=deposit');
    await expect(page.getByRole('link', { name: 'Getting your deposit back' })).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);
  });
}

test('the breadcrumb leaves a gap after each slash, measured where it is drawn', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stub(page);
  for (const path of ['/search', '/where-to-go']) {
    await page.goto(path);
    // The gap from the end of one step to the start of the next. A space the layout drops is 0.
    const gaps = await page.getByRole('navigation', { name: 'Breadcrumb' }).locator('li').evaluateAll((items) => items.slice(0, -1).map((li, i) => {
      const slash = li.querySelector('[aria-hidden="true"]').getBoundingClientRect();
      return Math.round((items[i + 1].getBoundingClientRect().left - slash.right) * 10) / 10;
    }));
    expect(gaps.length).toBeGreaterThan(0);
    gaps.forEach((gap) => expect(gap).toBeGreaterThanOrEqual(0));
    const widths = await page.getByRole('navigation', { name: 'Breadcrumb' }).locator('li [aria-hidden="true"]').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)));
    // " / " is a slash with a space on each side, so wider than the slash alone (about 5 px).
    widths.forEach((w) => expect(w).toBeGreaterThan(9));
  }
});

test('after a search from the menu the page heading takes focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stub(page);
  await page.goto('/');
  await page.getByRole('search', { name: 'Site search' }).getByRole('searchbox').fill('deposit');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Getting your deposit back' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeFocused();
  // The menu box is empty again so it never disagrees with the page.
  await expect(page.getByRole('search', { name: 'Site search' }).getByRole('searchbox')).toHaveValue('');
});

test('a search on the results page keeps the cursor in the box', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stub(page);
  await page.goto('/search?q=deposit');
  const box = page.getByRole('search', { name: 'Search results' }).getByRole('searchbox');
  await box.fill('rent');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=rent$/);
  await expect(box).toBeFocused();
});

test('with the menu hidden a Search link is still in the slim bar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('alc.sidebar', 'hidden'));
  await stub(page);
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Search the site' });
  await expect(link).toBeVisible();
  const box = await link.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await link.click();
  await expect(page).toHaveURL(/\/search$/);
});

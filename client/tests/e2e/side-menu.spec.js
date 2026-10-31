import { test, expect } from '@playwright/test';
import { stubApi, DATA, scrollsSideways, signInAs } from './support.js';

// The side menu on a wide screen can be narrowed or hidden. The choice is kept on the device.
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await stubApi(page, { 'GET /emergency-contacts': () => DATA.contacts, 'GET /directory/routes': () => DATA.routeCards });
});

const header = (page) => page.locator('header').first();
// Home has more than one Where to Go link. The menu has one.
const menuLink = (page, name) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });
// Starts a page in one of the three modes by setting what the device would have kept.
const startIn = (page, mode) => page.addInitScript((m) => {
  if (m === 'expanded') localStorage.removeItem('alc.sidebar');
  else localStorage.setItem('alc.sidebar', m);
}, mode);

test('the menu narrows to an icon with a short word and widens again', async ({ page }) => {
  await page.goto('/');
  expect((await header(page).boundingBox()).width).toBeCloseTo(252, 0);
  await page.getByRole('button', { name: 'Narrow menu' }).click();
  expect((await header(page).boundingBox()).width).toBeCloseTo(104, 0);
  // The words are still on the screen, small, under each icon. The emergency link has its words too.
  await expect(menuLink(page, 'Where to Go')).toBeVisible();
  await expect(menuLink(page, 'Where to Go').getByText('Where to Go')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Emergency numbers' }).getByText('Emergency numbers')).toBeVisible();
  expect(await scrollsSideways(page)).toBe(false);
  await page.getByRole('button', { name: 'Widen menu' }).click();
  expect((await header(page).boundingBox()).width).toBeCloseTo(252, 0);
});

test('the menu hides, leaves the emergency link, and shows again', async ({ page }) => {
  await page.goto('/where-to-go');
  await page.getByRole('button', { name: 'Hide menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Emergency numbers' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show menu' })).toBeFocused();
  // The bar is slim and the page takes the whole width.
  expect((await header(page).boundingBox()).height).toBeLessThan(100);
  expect((await page.locator('main').boundingBox()).width).toBeGreaterThan(1200);
  expect(await scrollsSideways(page)).toBe(false);
  await page.getByRole('button', { name: 'Show menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Narrow menu' })).toBeFocused();
});

test('the choice is kept after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Hide menu' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Show menu' }).click();
  await page.getByRole('button', { name: 'Narrow menu' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Widen menu' })).toBeVisible();
});

test('hiding a narrow menu and reloading brings back the narrow width', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Narrow menu' }).click();
  await page.getByRole('button', { name: 'Hide menu' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Show menu' }).click();
  await expect(page.getByRole('button', { name: 'Widen menu' })).toBeVisible();
});

test('on a phone the controls do not exist and Menu still works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Narrow menu' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Hide menu' })).toBeHidden();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(menuLink(page, 'Where to Go')).toBeVisible();
  // Choosing a link closes the list and leaves focus on the Menu button.
  await menuLink(page, 'Legal Guides').click();
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
});

// The word under an icon must stay inside its tile with some air on each side, and clear of the bar on
// its left edge. A long word such as "Appointments" is one piece and cannot wrap, so the narrow menu has
// to be wide enough for it. At the old width it fitted by less than 2 pixels and looked cramped.
for (const role of ['visitor', 'student', 'expert', 'admin']) {
  test(`every word in the narrow menu stays inside its tile for a ${role}`, async ({ page }) => {
    if (role !== 'visitor') await signInAs(page, role);
    await startIn(page, 'collapsed');
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const crossing = await page.evaluate(() => {
      const found = [];
      const CLEAR = 3;
      let checked = 0;
      for (const el of document.querySelectorAll('nav#side-nav a, nav#side-nav button')) {
        const box = el.getBoundingClientRect();
        if (box.width === 0) continue;
        const style = getComputedStyle(el);
        const left = box.left + parseFloat(style.borderLeftWidth);
        const right = box.right - parseFloat(style.borderRightWidth);
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent.trim() || node.parentElement.closest('[aria-hidden="true"], .material-symbols-outlined')) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (rect.width < 1) continue;
            checked += 1;
            if (rect.left < left + CLEAR || rect.right > right - CLEAR) found.push(node.textContent.trim());
          }
        }
      }
      return { found, checked };
    });
    expect(crossing.checked, 'no words were measured').toBeGreaterThan(4);
    expect(crossing.found).toEqual([]);
  });
}

for (const mode of ['expanded', 'collapsed', 'hidden']) {
  test(`every control in the ${mode} menu is at least 44 pixels each way`, async ({ page }) => {
    await startIn(page, mode);
    await page.goto('/');
    const targets = page.locator('header a, header button');
    let measured = 0;
    for (let i = 0; i < await targets.count(); i += 1) {
      if (!(await targets.nth(i).isVisible())) continue;
      const box = await targets.nth(i).boundingBox();
      expect(box.height, `control ${i} is too short`).toBeGreaterThanOrEqual(43.5);
      expect(box.width, `control ${i} is too narrow`).toBeGreaterThanOrEqual(43.5);
      measured += 1;
    }
    expect(measured, 'no controls found').toBeGreaterThan(2);
  });

  test(`no icon shows its name as a word in the ${mode} menu`, async ({ page }) => {
    await startIn(page, mode);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const wordy = await page.evaluate(() => [...document.querySelectorAll('header .material-symbols-outlined')]
      .filter((i) => i.getClientRects().length && i.scrollWidth > i.clientWidth + 1).map((i) => i.textContent));
    expect(wordy).toEqual([]);
  });
}

for (const width of [320, 390, 834]) {
  test(`a hidden menu fits at ${width} pixels with the emergency link before Menu`, async ({ page }) => {
    await startIn(page, 'hidden');
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    expect(await scrollsSideways(page)).toBe(false);
    const chip = await page.getByRole('link', { name: 'Emergency numbers' }).boundingBox();
    const menu = page.getByRole('button', { name: width >= 1024 ? 'Show menu' : 'Menu', exact: true });
    const menuBox = await menu.boundingBox();
    // Same row and to its left, or on the row above it.
    expect(chip.y < menuBox.y + 1 || chip.x < menuBox.x).toBe(true);
    for (const box of [chip, menuBox]) expect(box.height).toBeGreaterThanOrEqual(43.5);
  });
}

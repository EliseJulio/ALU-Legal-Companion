import { test, expect } from '@playwright/test';
import { stubApi, DATA } from './support.js';

// Keyboard use, a visible focus ring, and the 44 px target size on the footer links.

test.beforeEach(async ({ page }) => {
  await stubApi(page, {
    'GET /emergency-contacts': () => DATA.contacts,
    'GET /directory/routes': () => DATA.routeCards,
    'GET /guides': () => [DATA.guide()],
  });
});

const ready = async (page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Understand your issue/ })).toBeVisible();
};

test('the main menu is reached by keyboard in order, with the emergency numbers before the search', async ({ page, browserName }) => {
  await ready(page);
  const names = ['Skip to main content', /Legal Companion/, 'Emergency numbers', 'Search the site'];
  if (browserName === 'webkit') {
    // Safari does not Tab to links unless its own setting is on. Each link is focused directly and
    // they must come in the same order in the page.
    let before = -1;
    for (const name of names) {
      const link = page.getByRole('link', { name }).first();
      await link.focus();
      await expect(link).toBeFocused();
      const place = await link.evaluate((el) => [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].indexOf(el));
      expect(place).toBeGreaterThan(before);
      before = place;
    }
    return;
  }
  for (const name of names) {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name }).first()).toBeFocused();
  }
});

test('the control you have reached by keyboard shows a visible focus ring', async ({ page, browserName }) => {
  await ready(page);
  const link = page.getByRole('link', { name: 'Emergency numbers' });
  if (browserName === 'webkit') {
    await page.keyboard.press('Shift');
    await link.focus();
  } else {
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('Tab');
  }
  await expect(link).toBeFocused();
  const ring = await link.evaluate((el) => {
    const s = getComputedStyle(el);
    return { outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow !== 'none' };
  });
  expect(ring.outline || ring.shadow).toBe(true);
});

for (const width of [1440, 390]) {
  test(`every footer link is at least 44 px high at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page);
    const links = page.locator('footer a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      if (!(await links.nth(i).isVisible())) continue;
      const box = await links.nth(i).boundingBox();
      const name = (await links.nth(i).innerText()).trim();
      expect(box.height, `"${name}" is too short`).toBeGreaterThanOrEqual(43.5);
    }
  });
}

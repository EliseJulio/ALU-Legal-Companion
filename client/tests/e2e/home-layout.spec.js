import { test, expect } from '@playwright/test';
import { stubApi, DATA, scrollsSideways } from './support.js';

// The Home page at the three widths of the Figma frames: desktop, tablet and phone.

const stub = (page) => stubApi(page, {
  'GET /emergency-contacts': () => DATA.contacts,
  'GET /directory/routes': () => [],
  'GET /guides': () => [{ ...DATA.guide(), summary: 'How to get a deposit back.' }],
});

const subjectBox = (page) => page.getByRole('region', { name: 'Everyday questions. A more informed start.' });

test('on a desktop the buttons of one row of subject cards line up', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stub(page);
  await page.goto('/');
  const buttons = subjectBox(page).getByRole('link', { name: /^Explore / });
  await expect(buttons).toHaveCount(6);
  const boxes = await buttons.evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) };
  }));
  // Three columns at this width, so the cards fall in rows of three in the order they are listed.
  const rows = [boxes.slice(0, 3), boxes.slice(3, 6)];
  rows.forEach((row) => {
    const bottoms = row.map((b) => b.bottom);
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
  });
});

for (const width of [768, 834, 1023]) {
  test(`at ${width} px the three pathway steps sit side by side`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    await stub(page);
    await page.goto('/');
    const steps = page.getByRole('complementary', { name: 'Clarity comes one step at a time.' }).getByRole('listitem');
    await expect(steps).toHaveCount(3);
    const tops = await steps.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
    expect(await scrollsSideways(page)).toBe(false);
  });
}

test('on a phone the subjects are compact rows and each whole row is a link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await stub(page);
  await page.goto('/');
  const rows = subjectBox(page).getByRole('listitem');
  await expect(rows).toHaveCount(6);
  const heights = await rows.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
  heights.forEach((h) => { expect(h).toBeGreaterThanOrEqual(44); expect(h).toBeLessThanOrEqual(76); });
  const link = subjectBox(page).getByRole('link', { name: 'Explore Renting' });
  const box = await link.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  // The label is a word on the row. The link has no visible "Explore" on a phone.
  await expect(subjectBox(page).getByRole('heading', { name: 'Renting' })).toBeVisible();
  // Pressing the word on the row, away from the arrow, still opens the subject.
  await rows.first().click({ position: { x: 12, y: 12 } });
  await expect(page).toHaveURL(/\/guides\?domain=tenancy$/);
});

test('on a phone nothing makes the page scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await stub(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await scrollsSideways(page)).toBe(false);
});

test('a guide card on Home shows its summary', async ({ page }) => {
  await stub(page);
  await page.goto('/');
  await expect(page.getByText('How to get a deposit back.')).toBeVisible();
});

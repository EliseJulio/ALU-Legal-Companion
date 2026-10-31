import { test, expect } from '@playwright/test';
import { stubApi, signInAs, DATA } from './support.js';

// An icon is a box one em high with overflow hidden. If anything gives it a taller line, the glyph
// sits low and its bottom is cut off. This checks every icon on a page: the line is as tall as the
// letter and the box is square. The pixel check at the end looks at one icon the way a reader does.

const PAGES = [
  ['visitor', '/'], ['visitor', '/where-to-go'], ['visitor', '/directory'], ['visitor', '/guides'],
  ['visitor', '/emergency'], ['visitor', '/ask'], ['visitor', '/login'], ['visitor', '/search?q=deposit'],
  ['student', '/matters'], ['student', '/my-activity'], ['student', '/saved'],
  ['expert', '/expert'], ['expert', '/expert/directory'], ['admin', '/admin'], ['admin', '/admin/routes'],
];

async function clippedIcons(page) {
  return page.evaluate(() => [...document.querySelectorAll('.material-symbols-outlined')]
    .filter((el) => el.getClientRects().length > 0)
    .map((el) => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        name: el.textContent.trim(),
        lineHeight: style.lineHeight,
        fontSize: style.fontSize,
        square: Math.abs(box.width - box.height) <= 1,
      };
    })
    .filter((icon) => icon.lineHeight !== icon.fontSize || !icon.square));
}

for (const width of [390, 1440]) {
  for (const [who, path] of PAGES) {
    test(`no icon is cut off on ${path} for a ${who} at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await stubApi(page, {
        'GET /emergency-contacts': () => DATA.contacts,
        'GET /directory/routes': () => DATA.routeCards,
        'GET /directory/providers': () => [DATA.provider()],
        'GET /guides': () => [DATA.guide()],
        'GET /search': () => ({ query: 'deposit', results: { guides: [], routes: [], providers: [] } }),
      });
      if (who !== 'visitor') await signInAs(page, who);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      expect(await clippedIcons(page)).toEqual([]);
    });
  }
}

test('the house icon on Home is drawn all the way down to its base', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubApi(page, { 'GET /emergency-contacts': () => DATA.contacts, 'GET /directory/routes': () => [], 'GET /guides': () => [] });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const icon = page.getByRole('region', { name: 'Everyday questions. A more informed start.' }).locator('.material-symbols-outlined').first();
  await icon.scrollIntoViewIfNeeded();
  const box = await icon.boundingBox();
  // Read the icon's own pixels as a reader sees them.
  const png = await page.screenshot({ clip: box });
  const dark = await page.evaluate(async (base64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
    let lowest = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (data[i] + data[i + 1] + data[i + 2] < 300) lowest = y;
      }
    }
    return { lowest, height };
  }, png.toString('base64'));
  // The base of the house sits in the lower part of the box and stops before its last row. An icon
  // that is cut off has ink on the very last row because the box edge is where it was cut.
  expect(dark.lowest).toBeGreaterThanOrEqual(Math.floor(dark.height * 0.6));
  expect(dark.lowest).toBeLessThan(dark.height - 1);
});

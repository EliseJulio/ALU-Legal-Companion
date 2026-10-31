import { test, expect } from '@playwright/test';
import { stubApi, DATA } from './support.js';

// A link that ends in an arrow must leave a gap before it. A space between two parts of a link
// that is laid out as a flex row is dropped, and "Ask a legal expert→" runs together. A test on the
// words cannot see that, so this measures where the arrow is drawn.

const PAGES = ['/', '/where-to-go', '/where-to-go/1', '/directory', '/guides', '/search?q=deposit'];

async function runTogether(page) {
  return page.evaluate(() => {
    const found = [];
    let checked = 0;
    for (const link of document.querySelectorAll('a')) {
      if (link.getClientRects().length === 0) continue;
      const arrow = [...link.querySelectorAll('span[aria-hidden="true"]')].find((s) => /→/.test(s.textContent));
      if (!arrow) continue;
      // The text before the arrow, then the arrow glyph itself.
      let before = arrow.previousSibling;
      // Words only for a screen reader are off the page, so they are not "before" what is drawn.
      const hiddenWords = (n) => n.nodeType === 1 && n.classList.contains('sr-only');
      while (before && (!(before.textContent || '').trim() || hiddenWords(before))) before = before.previousSibling;
      if (!before) continue;
      const textRange = document.createRange();
      textRange.selectNodeContents(before);
      const textEnd = [...textRange.getClientRects()].pop()?.right;
      if (textEnd === undefined) { found.push(`${link.textContent.trim()} (text has no box)`); continue; }
      checked += 1;
      const node = [...arrow.childNodes].find((n) => n.nodeType === 3);
      const glyph = document.createRange();
      glyph.setStart(node, node.length - 1);
      glyph.setEnd(node, node.length);
      const gap = glyph.getBoundingClientRect().left - textEnd;
      if (gap < 2) found.push(`${link.textContent.trim()} (gap ${gap.toFixed(1)}px)`);
    }
    return { checked, found };
  });
}

for (const width of [390, 1440]) {
  for (const path of PAGES) {
    test(`every arrow link on ${path} leaves a gap before the arrow at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await stubApi(page, {
        'GET /emergency-contacts': () => DATA.contacts,
        'GET /directory/routes': () => DATA.routeCards,
        'GET /directory/routes/:id': () => DATA.route(),
        'GET /directory/providers': () => [DATA.provider()],
        'GET /guides': () => [DATA.guide()],
        'GET /search': () => ({ query: 'deposit', results: { guides: [], routes: [], providers: [] } }),
      });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      const { checked, found } = await runTogether(page);
      expect(found).toEqual([]);
      // Home and Where to Go have arrow links. If none was measured the test would prove nothing.
      if (['/', '/where-to-go'].includes(path)) expect(checked).toBeGreaterThan(0);
    });
  }
}

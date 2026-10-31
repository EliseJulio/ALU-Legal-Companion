import { test, expect } from '@playwright/test';
import { stubApi, reply, DATA, scrollsSideways } from './support.js';

// Sprint 7: the guide library and its filter, a guide, the emergency numbers and asking an expert.

const guide = (id, domain, title) => ({ ...DATA.guide({ id, domain, title }), summary: null });
const LIST = [guide(1, 'tenancy', 'Getting your deposit back'), guide(2, 'employment', 'Your written contract'), guide(3, 'immigration', 'Staying on a student permit')];
const common = {
  'GET /emergency-contacts': () => DATA.contacts,
  'GET /guides': () => LIST,
  'GET /guides/:id': ({ params }) => LIST.find((g) => String(g.id) === params.id) ?? reply({ error: 'not found' }, 404),
};
const titles = (page) => page.getByRole('main').getByRole('link', { name: /Getting your deposit back|Your written contract|Staying on a student permit/ });

test('on a wide screen several topics can be chosen and the list follows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubApi(page, common);
  await page.goto('/guides');
  await expect(titles(page)).toHaveCount(3);
  const group = page.getByRole('group', { name: 'Filter by topic' });
  await group.getByRole('button', { name: 'Renting', exact: true }).click();
  await group.getByRole('button', { name: 'Work', exact: true }).click();
  await expect(titles(page)).toHaveCount(2);
  await expect(page).toHaveURL(/domain=tenancy%2Cemployment/);
  for (const button of await group.getByRole('button').all()) {
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(43.5);
  }
  await group.getByRole('button', { name: 'All', exact: true }).click();
  await expect(titles(page)).toHaveCount(3);
});

test('on a phone the Filter guides panel opens, applies, closes and gives focus back', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubApi(page, common);
  await page.goto('/guides');
  const trigger = page.getByRole('button', { name: /^Filter guides/ });
  await trigger.click();
  const panel = page.getByRole('region', { name: 'Filter guides' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('checkbox', { name: 'Renting' })).toBeFocused();
  for (const box of await panel.getByRole('checkbox').all()) {
    const label = box.locator('xpath=ancestor::label');
    expect((await label.boundingBox()).height).toBeGreaterThanOrEqual(43.5);
  }
  await panel.getByRole('checkbox', { name: 'Work' }).check();
  await panel.getByRole('checkbox', { name: 'Immigration' }).check();
  await panel.getByRole('button', { name: 'Apply filters' }).click();
  await expect(panel).toHaveCount(0);
  await expect(titles(page)).toHaveCount(2);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText('Filter guides (2)');
  await expect(page.getByRole('group', { name: 'Applied filters' }).getByRole('button')).toHaveCount(2);
  await page.getByRole('group', { name: 'Applied filters' }).getByRole('button', { name: 'Remove filter: Work' }).click();
  await expect(titles(page)).toHaveCount(1);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('the topic buttons are not drawn on a phone and the Filter guides button is not drawn on a desktop', async ({ page }) => {
  await stubApi(page, common);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/guides');
  await expect(page.getByRole('button', { name: /^Filter guides/ })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Filter by topic' })).toHaveCount(0);
  // The panel is open when the window grows. It goes away with the phone layout and does not come back.
  await page.getByRole('button', { name: /^Filter guides/ }).click();
  await expect(page.getByRole('region', { name: 'Filter guides' })).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.getByRole('button', { name: /^Filter guides/ })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Filter guides' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Filter by topic' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: /^Filter guides/ })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('region', { name: 'Filter guides' })).toHaveCount(0);
});

test('every page has its own title in the browser tab, taken from its heading', async ({ page }) => {
  await stubApi(page, common);
  const title = async (path, heading) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    return page.title();
  };
  expect(await title('/emergency', 'Emergency numbers')).toBe('Emergency numbers | ALU Legal Companion');
  expect(await title('/ask', 'Ask a human legal expert')).toBe('Ask a human legal expert | ALU Legal Companion');
  expect(await title('/guides/1', 'Getting your deposit back')).toBe('Getting your deposit back | ALU Legal Companion');
  await page.goto('/');
  await expect(page).toHaveTitle('ALU Legal Companion');
});

test('in a guide the contents are a card on a phone and plain beside the text on a desktop', async ({ page }) => {
  await stubApi(page, common);
  const border = () => page.getByRole('navigation', { name: 'In this guide' }).evaluate((nav) => parseFloat(getComputedStyle(nav.parentElement).borderTopWidth));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/guides/1');
  await expect.poll(border).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(border).toBe(0);
});

test('the emergency page has the same name as the menu link and can load the contacts again', async ({ page }) => {
  let calls = 0;
  await stubApi(page, { 'GET /emergency-contacts': () => { calls += 1; return calls === 1 ? reply({ error: 'The server is busy.' }, 500) : DATA.contacts; } });
  await page.goto('/emergency');
  await expect(page.getByRole('heading', { level: 1, name: 'Emergency numbers' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'If you cannot get online help' })).toBeVisible();
  await expect(page.getByText('The server is busy.')).toBeVisible();
  await page.getByRole('button', { name: 'Try loading contacts again' }).click();
  await expect(page.getByRole('heading', { name: 'Isange One Stop Centre', level: 3 })).toBeVisible();
  // The button that was pressed has left the page, so focus is on the Contacts heading, not lost.
  await expect(page.getByRole('heading', { level: 2, name: 'Contacts' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Try loading contacts again' })).toHaveCount(0);
});

test('asking an expert needs the code promise, ties the message to the box and offers sign in', async ({ page }) => {
  const api = await stubApi(page, { ...common, 'POST /questions/anonymous': () => ({ id: 1, anon_token: DATA.code }) });
  await page.goto('/ask');
  await expect(page.getByRole('heading', { level: 1, name: 'Ask a human legal expert' })).toBeVisible();
  await page.getByLabel('Your question').fill('Can my landlord keep my deposit?');
  await page.getByRole('button', { name: 'Send my question' }).click();
  const box = page.getByLabel('I understand the code cannot be recovered.');
  await expect(page.getByRole('alert')).toContainText('Tick the box to say you understand');
  await expect(box).toBeFocused();
  await expect(box).toHaveAttribute('aria-invalid', 'true');
  expect(api.sent('POST', '/questions/anonymous')).toHaveLength(0);
  await box.check();
  await page.getByRole('button', { name: 'Send my question' }).click();
  await expect(page.getByText(DATA.code)).toBeVisible();
});

test('a visitor can choose to sign in instead of asking anonymously', async ({ page }) => {
  await stubApi(page, common);
  await page.goto('/ask');
  await page.getByRole('link', { name: 'Sign in instead' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fask$/);
});

for (const width of [320, 390, 834, 1440]) {
  test(`the guide pages, the emergency page and the ask page do not scroll sideways at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await stubApi(page, common);
    for (const path of ['/guides', '/guides/1', '/emergency', '/ask']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await scrollsSideways(page)).toBe(false);
    }
  });
}

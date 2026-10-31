import { test, expect } from '@playwright/test';
import { stubApi, signInAs, DATA, scrollsSideways } from './support.js';

// Sprint 9: the student pages. My Matters, a matter, New matter, Saved Resources, My Activity
// and Account settings, at the four widths of the design.

const GUIDE = { id: 1, domain: 'tenancy', title: 'Getting your deposit back', source_law: 'Law No. 00/0000', verified_at: '2026-09-02T09:00:00Z' };
const MATTERS = [
  { id: 7, title: 'Rental deposit', status: 'open', next_action: 'Prepare questions', next_due: null, shared_with_name: null },
  { id: 8, title: 'Workplace question', status: 'open', next_action: 'Review my summary', next_due: '2099-01-10', shared_with_name: 'Example Legal Expert' },
  { id: 9, title: 'Old dispute', status: 'closed', next_action: null, next_due: null, shared_with_name: null },
];
const api = {
  'GET /emergency-contacts': () => DATA.contacts,
  'GET /matters': () => MATTERS,
  'GET /matters/share-targets': () => [{ id: 9, name: 'Example Legal Expert' }],
  'GET /matters/:id': () => DATA.matter({ title: 'Rental deposit', next_due: null, events: [{ id: 1, occurred_on: '2026-10-20', description: 'Made a short summary.', author_is_owner: true }], reminders: [] }),
  'GET /matters/:id/checklist': () => ({ checklist: null }),
  'GET /matters/:id/documents': () => [],
  'GET /bookmarks': () => [GUIDE],
  'DELETE /guides/:id/bookmark': () => ({ __reply: true, status: 204 }),
  'GET /questions/mine': () => [{ id: 1, text: 'Can my landlord keep my deposit?', answer: null, created_at: '2026-10-01T10:00:00Z' }],
  'GET /bookings/mine': () => [{ id: 1, status: 'accepted', slot: '2099-01-01T08:00:00.000Z', topic: 'My deposit', provider_name: 'Example Pro Bono Lawyer', meet_link: 'https://meet.example.org/abc' }],
  'GET /auth/me': () => ({ id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student', email_verified_at: '2026-09-01T00:00:00Z', created_at: '2026-08-01T00:00:00Z', pending_email: null }),
};
const PAGES = [
  ['/matters', 'My Matters'],
  ['/matters/new', 'New matter'],
  ['/matters/7', 'Rental deposit'],
  ['/saved', 'Saved Resources'],
  ['/my-activity', 'My Activity'],
  ['/settings', 'Account settings'],
];

for (const width of [320, 390, 834, 1440]) {
  test(`the student pages do not scroll sideways at ${width} px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    await signInAs(page, 'student');
    await stubApi(page, api);
    for (const [path, heading] of PAGES) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      expect(await scrollsSideways(page), path).toBe(false);
    }
  });
}

test('on a wide screen My Matters is a table and the whole Open link is a 44 px target', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, 'student');
  await stubApi(page, api);
  await page.goto('/matters');
  const table = page.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(3);
  const link = table.getByRole('link', { name: 'Open Rental deposit' });
  expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(43.5);
  await page.getByRole('button', { name: /^Finished/ }).click();
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table.getByRole('rowheader', { name: /Old dispute/ })).toBeVisible();
});

test('on a tablet My Matters is cards, not a table', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 900 });
  await signInAs(page, 'student');
  await stubApi(page, api);
  await page.goto('/matters');
  await expect(page.getByRole('link', { name: /Rental deposit/ })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('a matter has its sharing column beside it on a desktop and under it on a tablet', async ({ page }) => {
  await signInAs(page, 'student');
  await stubApi(page, api);
  const box = (name) => page.getByRole('heading', { level: 2, name }).boundingBox();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/matters/7');
  await expect(page.getByRole('heading', { level: 2, name: 'Share with one chosen expert' })).toBeVisible();
  const next = await box('What comes next');
  const share = await box('Share with one chosen expert');
  expect(share.x).toBeGreaterThan(next.x + 400);
  await page.setViewportSize({ width: 834, height: 900 });
  await expect.poll(async () => (await box('Share with one chosen expert')).y).toBeGreaterThan((await box('What comes next')).y + 200);
  expect((await box('Share with one chosen expert')).x).toBeLessThan(120);
});

test('the dark What comes next card opens the edit form and Cancel closes it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, 'student');
  await stubApi(page, api);
  await page.goto('/matters/7');
  await page.getByRole('button', { name: 'Change next step or deadline' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Edit next step' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Edit next step' })).toHaveCount(0);
});

test('Delete matter asks, puts focus on Keep matter and gives it back to Delete', async ({ page }) => {
  await signInAs(page, 'student');
  await stubApi(page, api);
  await page.goto('/matters/7');
  await page.getByRole('button', { name: 'Delete matter…' }).click();
  await expect(page.getByRole('button', { name: 'Keep matter' })).toBeFocused();
  await page.getByRole('button', { name: 'Keep matter' }).click();
  await expect(page.getByRole('button', { name: 'Delete matter…' })).toBeFocused();
});

test('every control on a matter is at least 44 px high on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, 'student');
  await stubApi(page, api);
  await page.goto('/matters/7');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const button of await page.getByRole('main').getByRole('button').all()) {
    if (!(await button.isVisible())) continue;
    expect((await button.boundingBox()).height, await button.innerText()).toBeGreaterThanOrEqual(43.5);
  }
});

test('on a wide screen Saved Resources is a table and Remove from saved takes the guide off', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, 'student');
  let saved = [{ ...GUIDE, status: 'published' }];
  const stub = await stubApi(page, { ...api, 'GET /bookmarks': () => saved, 'DELETE /guides/:id/bookmark': () => { saved = []; return { __reply: true, status: 204 }; } });
  await page.goto('/saved');
  const table = page.getByRole('table');
  await expect(table.getByRole('link', { name: 'Read guide Getting your deposit back' })).toBeVisible();
  await table.getByRole('button', { name: /^Remove from saved/ }).click();
  await expect(page.getByText(/Removed “Getting your deposit back”/)).toBeVisible();
  await expect(page.getByText('You have not saved any guides yet.')).toBeVisible();
  expect(stub.sent('DELETE', '/guides/1/bookmark')).toHaveLength(1);
  await expect(page.getByRole('status').filter({ hasText: 'Removed' })).toBeFocused();
});

test('on a wide screen My Activity has two tables and the private note beside the anonymous card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, 'student');
  await stubApi(page, api);
  await page.goto('/my-activity');
  await expect(page.getByRole('table')).toHaveCount(2);
  const note = await page.getByText('This is your private account activity').boundingBox();
  const anon = await page.getByRole('heading', { level: 2, name: 'Asked anonymously?' }).boundingBox();
  expect(anon.x).toBeGreaterThan(note.x + 300);
});

test('Account settings puts the overview beside the forms on a desktop and above them on a tablet', async ({ page }) => {
  await signInAs(page, 'student');
  await stubApi(page, api);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/settings');
  const overview = page.getByRole('heading', { level: 2, name: 'Overview' });
  const name = page.getByRole('heading', { level: 2, name: 'Your name' });
  await expect(overview).toBeVisible();
  expect((await name.boundingBox()).x).toBeGreaterThan((await overview.boundingBox()).x + 300);
  await page.setViewportSize({ width: 834, height: 900 });
  await expect.poll(async () => (await name.boundingBox()).y).toBeGreaterThan((await overview.boundingBox()).y + 100);
});

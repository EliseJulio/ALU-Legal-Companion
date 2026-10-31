import { test, expect } from '@playwright/test';
import { stubApi, signInAs, DATA, scrollsSideways } from './support.js';

// The expert consultation and administrator pages, at the four widths of the design.

const GUIDES = [
  DATA.guide({ id: 1, status: 'pending_review', law_says: 'See [verify: Art. 5, Law 00/0000].' }),
  DATA.guide({ id: 2, status: 'pending_review', title: 'A Problem at Work', domain: 'employment' }),
  DATA.guide({ id: 3, status: 'draft', title: 'A draft', review_comment: 'Add the article for notice.' }),
];
const PROVIDER = { id: 1, name: 'Example Abunzi Committee', category: 'organisation', type: 'abunzi', location: 'Kigali', contact: 'Sector office', services: 'Mediation', languages: 'Kinyarwanda', is_free: true, official_source_url: 'https://example.org/a', last_checked_at: '2026-09-01', status: 'pending_review', user_id: null, bookable: false, stale: false, review_comment: null };
const ROUTE = { id: 1, matter_type: 'deposit_kept', title: 'My landlord kept my deposit', status: 'pending_review', steps: ['Write'], first_forum_name: 'Example Abunzi Committee', first_forum_status: 'pending_review', first_forum_id: 1, legal_basis: 'A lease is a contract.', exclusions: '', deadline_days: 30, deadline_runs_from: 'the day you left', deadline_note: '', keywords: '', area: 'tenancy', review_comment: null };
const BOOKINGS = [
  { id: 1, status: 'requested', slot: '2099-01-01T08:00:00.000Z', topic: 'A rental agreement', requester: 'Anonymous', meet_link: null },
  { id: 2, status: 'accepted', slot: '2099-02-01T08:00:00.000Z', topic: 'My deposit', requester: 'Test Student', meet_link: 'https://meet.google.com/abc-defg-hij' },
  { id: 3, status: 'completed', slot: '2026-09-01T08:00:00.000Z', topic: null, requester: 'Anonymous', meet_link: null },
];
const STATS = {
  guides: { draft: 1, pending_review: 2, published: 0 },
  directory: { providers: { draft: 0, pending_review: 1, published: 0 }, routes: { draft: 0, pending_review: 1, published: 0 }, stale: 0 },
  questions: { total: 1, anonymous: 1, open: 1 },
  bookings: { total: 3, anonymous: 2, by_status: { requested: 1, accepted: 1, declined: 0, completed: 1 } },
  matters: { total: 1, open: 1, shared: 1 },
  reminders: { pending: 0, sent: 0, sent_late: 0, missed: 0, cancelled: 0 },
  users: { student: 1, staff: 0, legal_expert: 1, admin: 1, deactivated: 0 },
};
const api = {
  'GET /emergency-contacts': () => DATA.contacts,
  'GET /guides/all': () => GUIDES,
  'GET /directory/providers/all': () => [PROVIDER],
  'GET /directory/routes/all': () => [ROUTE],
  'GET /questions/open': () => [
    { id: 1, kind: 'anonymous', text: 'Where can I find information about a rental deposit?', created_at: '2026-10-01T10:00:00Z' },
    { id: 2, kind: 'signed-in', text: 'Can my employer change my contract?', created_at: '2026-10-02T10:00:00Z' },
  ],
  'GET /bookings/expert': () => BOOKINGS,
  'GET /matters/shared': () => [{ id: 3, title: 'Rental deposit', status: 'open', route_title: 'My landlord kept my deposit', next_due: '2099-01-10' }],
  'GET /admin/stats': () => STATS,
  'GET /admin/users': () => [{ id: 1, name: 'Test Student', email: 's@example.org', role: 'student', created_at: '2026-08-01T00:00:00Z', email_verified_at: '2026-08-01T00:00:00Z', deactivated_at: null }],
  'GET /admin/invites': () => [{ id: 1, email: 'w@example.org', status: 'pending', invited_by: 'Test Admin', created_at: '2026-10-01T00:00:00Z', expires_at: '2026-10-08T00:00:00Z', used_at: null }],
  'GET /admin/emergency-contacts': () => [{ id: 1, name: 'Police', contact: '112', when_to_use: 'Immediate danger', sort_order: 1 }],
  'GET /checklists/all': () => [],
};
const EXPERT_PAGES = [['/expert/questions', 'Questions from the community.'], ['/expert/bookings', 'Your consultation requests.'], ['/expert/matters', 'Records shared with you.']];
const ADMIN_PAGES = [['/admin', 'Overview'], ['/admin/guides', 'Guides'], ['/admin/guides/3', 'Edit guide'], ['/admin/routes', 'Routes'], ['/admin/providers', 'Directory entries'], ['/admin/users', 'People'], ['/admin/invites', 'Invitations'], ['/admin/contacts', 'Urgent contacts']];

for (const width of [320, 390, 834, 1440]) {
  for (const [role, pages] of [['expert', EXPERT_PAGES], ['admin', ADMIN_PAGES]]) {
    test(`the ${role} pages do not scroll sideways at ${width} px`, async ({ page }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      await signInAs(page, role);
      await stubApi(page, api);
      for (const [path, heading] of pages) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        expect(await scrollsSideways(page), path).toBe(false);
      }
    });
  }
}

test('every control in the expert consultation pages is at least 44 px high on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, 'expert');
  await stubApi(page, api);
  await page.goto('/expert/questions');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const main = page.getByRole('main');
  for (const control of [...(await main.getByRole('button').all()), ...(await main.getByRole('link').all())]) {
    if (!(await control.isVisible())) continue;
    expect((await control.boundingBox()).height, await control.innerText()).toBeGreaterThanOrEqual(43.5);
  }
  for (const label of await main.locator('label:has(input[type=checkbox])').all()) {
    expect((await label.boundingBox()).height).toBeGreaterThanOrEqual(43.5);
  }
});

test('appointments put the accepted ones in a column of their own on a desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, 'expert');
  await stubApi(page, api);
  await page.goto('/expert/bookings');
  const pending = await page.getByRole('heading', { level: 2, name: 'Pending requests' }).boundingBox();
  const accepted = await page.getByRole('heading', { level: 2, name: 'Accepted appointments' }).boundingBox();
  const earlier = await page.getByRole('heading', { level: 2, name: 'Earlier requests' }).boundingBox();
  expect(accepted.x).toBeGreaterThan(pending.x + 400);
  expect(earlier.x).toBeLessThan(accepted.x);
  expect(earlier.y).toBeGreaterThan(pending.y);
  await expect(page.getByRole('link', { name: /Open the meeting/ })).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
});

test('questions put the list beside the answer on a desktop and the answer box is required', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, 'expert');
  await stubApi(page, api);
  await page.goto('/expert/questions');
  const list = await page.getByRole('list', { name: 'Open questions' }).boundingBox();
  const pane = await page.getByRole('heading', { level: 2, name: 'The question' }).boundingBox();
  expect(pane.x).toBeGreaterThan(list.x + 300);
  await expect(page.getByLabel('Your written answer')).toHaveAttribute('aria-required', 'true');
});

test('invitations put the form beside the sent list on a desktop and above it on a tablet', async ({ page }) => {
  await signInAs(page, 'admin');
  await stubApi(page, api);
  const form = page.getByRole('heading', { level: 2, name: 'New expert invitation' });
  const sent = page.getByRole('heading', { level: 2, name: 'Sent invitations' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/invites');
  expect((await sent.boundingBox()).x).toBeGreaterThan((await form.boundingBox()).x + 300);
  await page.setViewportSize({ width: 834, height: 900 });
  await expect.poll(async () => (await sent.boundingBox()).y).toBeGreaterThan((await form.boundingBox()).y + 100);
});

test('the guide editor has the publishing explanation beside it on a desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, 'admin');
  await stubApi(page, api);
  await page.goto('/admin/guides/3');
  await expect(page.getByRole('heading', { level: 2, name: 'Publishing' })).toBeVisible();
  const side = await page.getByRole('heading', { level: 2, name: 'Publishing' }).boundingBox();
  const field = await page.getByLabel('Title').boundingBox();
  expect(side.x).toBeGreaterThan(field.x + 400);
});

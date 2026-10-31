import { test, expect } from '@playwright/test';
import { stubApi, signInAs, DATA, openMenu } from './support.js';

// The staff workspaces. Legal experts provide consultations; administrators manage publication.

test('a visitor is asked to sign in and a student is told the page is not theirs', async ({ page }) => {
  await stubApi(page, {});
  await page.goto('/expert/questions');
  await expect(page.getByRole('heading', { name: 'Sign in to reach this page' })).toBeVisible();

  await signInAs(page, 'student');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'You do not have permission to open this page' })).toBeVisible();
  // A refused page never signs anyone out. On a phone the name is in the menu.
  await openMenu(page);
  await expect(page.locator('header').getByText('Test Student')).toBeVisible();
});

test('a legal expert cannot open the administrator content workspace', async ({ page }) => {
  await signInAs(page, 'expert');
  await stubApi(page, {});
  await page.goto('/admin/guides');
  await expect(page.getByRole('heading', { name: 'You do not have permission to open this page' })).toBeVisible();
});

test('an administrator publishes a guide directly', async ({ page }) => {
  await signInAs(page, 'admin');
  let guide = DATA.guide({ id: 1, status: 'draft' });
  const api = await stubApi(page, {
    'GET /guides/all': () => [guide],
    'POST /guides/:id/publish': () => {
      guide = { ...guide, status: 'published' };
      return { id: 1, status: 'published' };
    },
  });
  await page.goto('/admin/guides/1');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect.poll(() => api.sent('POST', '/guides/1/publish').length).toBe(1);
});

test('an expert answers a question and it leaves the list', async ({ page }) => {
  await signInAs(page, 'expert');
  let open = [{ id: 1, text: 'Can my landlord keep my deposit?', created_at: '2026-09-02T09:00:00Z', kind: 'anonymous' }];
  const api = await stubApi(page, {
    'GET /questions/open': () => open,
    'POST /questions/:id/answer': () => { open = []; return { id: 1, status: 'answered' }; },
  });
  await page.goto('/expert/questions');
  await expect(page.getByText(/Anonymous question/).first()).toBeVisible();
  await page.getByLabel('Your written answer').fill('Write to the landlord first.');
  await page.getByRole('button', { name: 'Send the answer' }).click();
  await expect(page.getByText('No questions are waiting.')).toBeVisible();
  expect(api.sent('POST', '/questions/1/answer')[0].body).toEqual({ answer: 'Write to the landlord first.' });
});

test('an expert accepts an appointment and sees the requester exactly as sent', async ({ page }) => {
  await signInAs(page, 'expert');
  let status = 'requested';
  const api = await stubApi(page, {
    'GET /bookings/expert': () => [{ id: 1, slot: '2099-01-01T08:00:00.000Z', topic: 'My deposit', status, requester: 'Anonymous', meet_link: 'https://meet.example.org/abc' }],
    'POST /bookings/:id/status': ({ body }) => { status = body.status; return {}; },
  });
  await page.goto('/expert/bookings');
  await expect(page.getByText('Anonymous', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Accept this time' }).click();
  await expect(page.getByRole('button', { name: 'Mark as completed' })).toBeVisible();
  expect(api.sent('POST', '/bookings/1/status')[0].body).toEqual({ status: 'accepted' });
});

test('an admin sees content-management pages but no retired review controls', async ({ page }) => {
  await signInAs(page, 'admin');
  const review = { draft: 1, pending_review: 2, published: 3 };
  await stubApi(page, {
    'GET /admin/stats': () => ({
      guides: review,
      directory: { providers: review, routes: review, stale: 0 },
      bookings: { total: 0, anonymous: 0, by_status: { requested: 0, accepted: 0, declined: 0, completed: 0 } },
      questions: { total: 0, anonymous: 0, open: 0 },
      matters: { total: 0, open: 0, shared: 0 },
      reminders: { pending: 0, sent: 0, missed: 0, cancelled: 0, sent_late: 0 },
      users: { student: 1, staff: 0, legal_expert: 1, admin: 1, deactivated: 0 },
    }),
    'GET /guides/all': () => [DATA.guide({ status: 'draft' })],
    'GET /directory/providers/all': () => [],
    'GET /directory/routes/all': () => [],
  });
  await page.goto('/admin');
  await expect(page.getByRole('region', { name: 'Guides' })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain('@');

  for (const path of ['/admin/guides', '/admin/providers', '/admin/routes']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /verify|send for review/i })).toHaveCount(0);
  }
});

test('an admin cannot save a published guide until they say they understand', async ({ page }) => {
  await signInAs(page, 'admin');
  const api = await stubApi(page, {
    'GET /guides/all': () => [DATA.guide({ id: 3, status: 'published' })],
    'PUT /guides/:id': () => ({}),
  });
  await page.goto('/admin/guides/3');
  await expect(page.getByText(/takes it off the site/)).toBeVisible();

  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Tick the box');
  expect(api.sent('PUT', '/guides/3')).toHaveLength(0);

  await page.getByLabel('I understand').check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => api.sent('PUT', '/guides/3').length).toBe(1);
  // Retired review actions are not exposed in the direct-administrator workflow.
  await expect(page.getByRole('button', { name: /verify|send for review/i })).toHaveCount(0);
});

test('an admin cannot switch off their own account', async ({ page }) => {
  await signInAs(page, 'admin');
  await stubApi(page, {
    'GET /admin/users': () => [
      { id: 3, name: 'Test Admin', email: 'admin@example.org', role: 'admin', email_verified_at: '2026-09-01T00:00:00Z', deactivated_at: null, created_at: '2026-09-01T00:00:00Z' },
      { id: 2, name: 'Test Expert', email: 'expert@example.org', role: 'legal_expert', email_verified_at: '2026-09-01T00:00:00Z', deactivated_at: null, created_at: '2026-09-01T00:00:00Z' },
    ],
  });
  await page.goto('/admin/users');
  const me = page.getByRole('listitem').filter({ hasText: 'This is you' });
  await expect(me.getByRole('button', { name: 'Switch off' })).toHaveCount(0);
  const expert = page.getByRole('listitem').filter({ hasText: 'Test Expert' });
  await expect(expert.getByRole('button', { name: 'Switch off' })).toBeVisible();
  // A legal expert is never offered as a role to give.
  await expect(expert.getByRole('combobox')).toHaveCount(0);
});

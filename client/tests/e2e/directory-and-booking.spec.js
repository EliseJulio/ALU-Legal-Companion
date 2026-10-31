import { test, expect } from '@playwright/test';
import { stubApi, signInAs, DATA } from './support.js';

// The directory of lawyers, consultants and organisations. Also booking a consultation.

const office = DATA.provider({ id: 2, name: 'Example Legal Aid Office', category: 'organisation', type: 'maj_office', bookable: false });

const directoryApi = {
  'GET /directory/providers': ({ query }) => (query.get('category') === 'lawyer' ? [DATA.provider()] : [DATA.provider(), office]),
  'GET /directory/providers/:id': () => DATA.provider(),
};

test('the directory can be narrowed to one group', async ({ page }) => {
  const api = await stubApi(page, directoryApi);
  await page.goto('/directory');
  await expect(page.getByRole('heading', { name: 'Example Legal Aid Office' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Category' }).getByRole('link', { name: 'Lawyers' }).click();
  await expect(page).toHaveURL(/category=lawyer/);
  await expect(page.getByRole('heading', { name: 'Example Pro Bono Lawyer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Example Legal Aid Office' })).toHaveCount(0);
  await expect.poll(() => api.calls.some((c) => c.path === '/directory/providers' && c.query.get('category') === 'lawyer')).toBe(true);
});

test('a link to the directory with a group in it opens already narrowed', async ({ page }) => {
  const api = await stubApi(page, directoryApi);
  await page.goto('/directory?category=lawyer');
  await expect(page.getByRole('navigation', { name: 'Category' }).getByRole('link', { name: 'Lawyers' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Example Pro Bono Lawyer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Example Legal Aid Office' })).toHaveCount(0);
  await expect.poll(() => api.calls.some((c) => c.path === '/directory/providers' && c.query.get('category') === 'lawyer')).toBe(true);
});

test('an office that takes no bookings offers no booking link', async ({ page }) => {
  await stubApi(page, directoryApi);
  await page.goto('/directory');
  const card = page.getByRole('listitem').filter({ hasText: 'Example Legal Aid Office' });
  await expect(card.getByText(/does not take online bookings/)).toBeVisible();
  await expect(card.getByRole('link', { name: 'Request consultation' })).toHaveCount(0);
});

test('a visitor books anonymously saves the code and checks the booking', async ({ page }) => {
  const api = await stubApi(page, {
    ...directoryApi,
    'POST /bookings/anonymous': () => ({ id: 1, anon_token: DATA.code }),
    'GET /bookings/anon/:token': () => ({
      id: 1, slot: '2099-01-01T08:00:00.000Z', topic: 'My deposit', status: 'accepted',
      provider_name: 'Example Pro Bono Lawyer', meet_link: 'https://meet.example.org/abc',
    }),
  });

  await page.goto('/directory');
  await page.getByRole('link', { name: 'Request consultation' }).click();
  await expect(page).toHaveURL(/\/directory\/book\/1$/);
  await expect(page.getByText(/shown one time only/)).toBeVisible();

  await page.getByLabel('Date and time').fill('2099-01-01T10:00');
  await page.getByLabel(/What is it about/).fill('My deposit');
  await page.getByLabel('I understand that I must save the code before leaving.').check();
  await page.getByRole('button', { name: 'Send consultation request' }).click();

  // The code is shown once. It is never put in the address bar.
  await expect(page.getByText(DATA.code)).toBeVisible();
  expect(page.url()).not.toContain(DATA.code);
  expect(api.sent('POST', '/bookings/anonymous')[0].authorization).toBeUndefined();

  // The reader must say the code is saved before moving on.
  const next = page.getByRole('button', { name: 'Continue to check my request' });
  await expect(next).toBeDisabled();
  await page.getByLabel(/I have saved my code/).check();
  await next.click();
  await expect(page).toHaveURL(/\/directory\/booking-check$/);

  await page.getByLabel('Your booking code').fill(DATA.code.toLowerCase());
  await page.getByRole('button', { name: 'Check booking' }).click();
  await expect(page.getByRole('heading', { name: 'The lawyer agreed to this time' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Join the video call/ })).toHaveAttribute('href', 'https://meet.example.org/abc');
  expect(page.url()).not.toContain(DATA.code.toLowerCase());
});

test('a student must choose between their name and anonymous before sending', async ({ page }) => {
  await signInAs(page, 'student');
  const api = await stubApi(page, {
    ...directoryApi,
    'POST /bookings': () => ({ id: 5, status: 'requested' }),
  });
  await page.goto('/directory/book/1');
  await page.getByLabel('Date and time').fill('2099-01-01T10:00');

  const send = page.getByRole('button', { name: 'Send consultation request' });
  await expect(send).toBeDisabled();
  await expect(page.getByRole('radio', { name: /With my name/ })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: 'Without my name' })).not.toBeChecked();

  await page.getByRole('radio', { name: /With my name/ }).check();
  await expect(send).toBeEnabled();
  await send.click();
  // The link is in the menu as well as on the page. Only the one on the page is wanted here.
  await expect(page.getByRole('main').getByRole('link', { name: 'My activity' })).toBeVisible();
  expect(api.sent('POST', '/bookings')[0].authorization).toBe('Bearer tok-test');
});

test('a booking time in the past is refused before anything is sent', async ({ page }) => {
  const api = await stubApi(page, directoryApi);
  await page.goto('/directory/book/1');
  await page.getByLabel('Date and time').fill('2001-01-01T10:00');
  await page.getByRole('button', { name: 'Send consultation request' }).click();
  await expect(page.getByRole('alert')).toContainText('Choose a time in the future.');
  expect(api.sent('POST', '/bookings/anonymous')).toHaveLength(0);
});

test('on a wide screen the directory is a comparison table with one row for each provider', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubApi(page, directoryApi);
  await page.goto('/directory');
  const table = page.getByRole('table', { name: /compared by services, location, languages and cost/i });
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader')).toHaveText(['Provider', 'Services', 'Location', 'Languages', 'Cost', 'Action']);
  await expect(table.getByRole('row')).toHaveCount(3);
  // One list is drawn. The cards are not also in the page.
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(0);
  // Every link in the table is a target a thumb or a pointer can hit.
  for (const link of await table.getByRole('link').all()) {
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(43.5);
  }
  await table.getByRole('link', { name: 'Request consultation with Example Pro Bono Lawyer' }).click();
  await expect(page).toHaveURL(/\/directory\/book\/1$/);
});

test('a contact-direct provider has an Expand listing button that opens its page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubApi(page, { ...directoryApi, 'GET /directory/providers/:id': () => office });
  await page.goto('/directory');
  await page.getByRole('link', { name: 'Expand listing for Example Legal Aid Office' }).click();
  await expect(page).toHaveURL(/\/directory\/2$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Example Legal Aid Office' })).toBeVisible();
});

test('on a tablet and a phone the directory is cards and not a table', async ({ page }) => {
  await stubApi(page, directoryApi);
  for (const width of [834, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/directory');
    await expect(page.getByRole('heading', { level: 3, name: 'Example Pro Bono Lawyer' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  }
});

test('the request page names the provider and will not send an anonymous request until the code is promised', async ({ page }) => {
  const api = await stubApi(page, { ...directoryApi, 'POST /bookings/anonymous': () => ({ id: 1, anon_token: DATA.code }) });
  await page.goto('/directory/book/1');
  await expect(page.getByRole('heading', { level: 1, name: 'Request a consultation' })).toBeVisible();
  await expect(page.getByText('Example Pro Bono Lawyer · A request is not a confirmed appointment.')).toBeVisible();
  await page.getByLabel('Date and time').fill('2099-01-01T10:00');
  await page.getByRole('button', { name: 'Send consultation request' }).click();
  await expect(page.getByRole('alert')).toContainText('Tick the box to say you will save the code');
  await expect(page.getByLabel('I understand that I must save the code before leaving.')).toBeFocused();
  expect(api.sent('POST', '/bookings/anonymous')).toHaveLength(0);
  await page.getByLabel('I understand that I must save the code before leaving.').check();
  await page.getByRole('button', { name: 'Send consultation request' }).click();
  await expect(page.getByText(DATA.code)).toBeVisible();
});

test('the request page can be cancelled and a visitor can sign in instead', async ({ page }) => {
  await stubApi(page, directoryApi);
  await page.goto('/directory/book/1');
  await page.getByRole('link', { name: 'Sign in instead' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fdirectory%2Fbook%2F1$/);
  await page.goto('/directory/book/1');
  await page.getByRole('link', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/directory$/);
});

for (const width of [320, 390, 834, 1440]) {
  test(`the directory, a listing and the request page do not scroll sideways at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await stubApi(page, { ...directoryApi, 'GET /directory/providers/:id': () => DATA.provider() });
    for (const path of ['/directory', '/directory/1', '/directory/book/1']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    }
  });
}

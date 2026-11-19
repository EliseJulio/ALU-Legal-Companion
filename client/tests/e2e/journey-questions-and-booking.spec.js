import { test, expect } from '@playwright/test';
import { stubApi, pickSlot, DATA } from './support.js';

// Asking a question and booking a consultation without giving a name. The code is shown once.

test('a visitor asks anonymously and reads the answer with the code', async ({ page }) => {
  let answer = null;
  const api = await stubApi(page, {
    'POST /questions/anonymous': () => ({ id: 1, anon_token: DATA.code }),
    'POST /questions/anon/status': () => ({ id: 1, text: 'Can my landlord keep my deposit?', answer, status: answer ? 'answered' : 'open' }),
  });

  await page.goto('/ask');
  await page.getByLabel('Your question').fill('Can my landlord keep my deposit?');
  await page.getByLabel('I understand the code cannot be recovered.').check();
  await page.getByRole('button', { name: 'Send my question' }).click();

  await expect(page.getByText(DATA.code)).toBeVisible();
  expect(page.url()).not.toContain(DATA.code);
  expect(api.sent('POST', '/questions/anonymous')[0].authorization).toBeUndefined();

  await page.getByLabel(/I have saved my code/).check();
  await page.getByRole('button', { name: 'Continue to check my request' }).click();
  await page.getByLabel('Your question code').fill(DATA.code);
  await page.getByRole('button', { name: 'Check for answer' }).click();
  await expect(page.getByRole('heading', { name: 'Awaiting a response' })).toBeVisible();

  answer = 'Write to the landlord first and keep a copy.';
  await page.getByRole('button', { name: 'Check for answer' }).click();
  await expect(page.getByText(answer)).toBeVisible();
  expect(page.url()).not.toContain(DATA.code);
});

test('a visitor books anonymously, saves the code, and checks the booking and gets the join link', async ({ page }) => {
  const api = await stubApi(page, {
    'GET /directory/providers': () => [DATA.provider()],
    'GET /directory/providers/:id': () => DATA.provider(),
    'GET /bookings/slots/:id': () => DATA.slots(),
    'POST /bookings/anonymous': () => ({ id: 1, anon_token: DATA.code }),
    'POST /bookings/anon/status': () => ({
      id: 1, slot: '2099-01-01T08:00:00.000Z', topic: 'My deposit', status: 'accepted',
      provider_name: 'Example Pro Bono Lawyer', meet_link: 'https://meet.example.org/abc',
    }),
  });

  await page.goto('/directory');
  await page.getByRole('link', { name: 'Request consultation' }).click();
  await pickSlot(page);
  await page.getByLabel(/What is it about/).fill('My deposit');
  await page.getByLabel('I understand that I must save the code before leaving.').check();
  await page.getByRole('button', { name: 'Send consultation request' }).click();

  await expect(page.getByText(DATA.code)).toBeVisible();
  expect(page.url()).not.toContain(DATA.code);
  expect(api.sent('POST', '/bookings/anonymous')[0].authorization).toBeUndefined();

  await page.getByLabel(/I have saved my code/).check();
  await page.getByRole('button', { name: 'Continue to check my request' }).click();
  await page.getByLabel('Your booking code').fill(DATA.code.toLowerCase());
  await page.getByRole('button', { name: 'Check booking' }).click();
  await expect(page.getByRole('link', { name: 'Join the call' })).toHaveAttribute('href', '/call/1');
  expect(page.url()).not.toContain(DATA.code.toLowerCase());
});

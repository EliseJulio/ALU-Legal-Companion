import { test, expect } from '@playwright/test';
import { stubApi, signInAs, reply, DATA } from './support.js';

// Asking a legal expert a question. A real person answers. No AI is involved.

test('a visitor asks anonymously and reads the answer with the code', async ({ page }) => {
  let answer = null;
  const api = await stubApi(page, {
    'POST /questions/anonymous': () => ({ id: 1, anon_token: DATA.code }),
    'GET /questions/anon/:token': () => ({ id: 1, text: 'Can my landlord keep my deposit?', answer, status: answer ? 'answered' : 'open' }),
  });

  await page.goto('/ask');
  await expect(page.getByRole('heading', { level: 1, name: 'Ask a human legal expert' })).toBeVisible();
  await expect(page.getByText(/A response is not guaranteed/)).toBeVisible();

  await page.getByLabel('Your question').fill('Can my landlord keep my deposit?');
  await page.getByLabel('I understand the code cannot be recovered.').check();
  await page.getByRole('button', { name: 'Send my question' }).click();

  await expect(page.getByText(DATA.code)).toBeVisible();
  expect(page.url()).not.toContain(DATA.code);
  expect(api.sent('POST', '/questions/anonymous')[0].authorization).toBeUndefined();

  await page.getByLabel(/I have saved my code/).check();
  await page.getByRole('button', { name: 'Continue to check my request' }).click();
  await expect(page).toHaveURL(/\/ask\/check$/);

  // Before an expert answers the reader is told to wait and not to send it again.
  await page.getByLabel('Your question code').fill(DATA.code);
  await page.getByRole('button', { name: 'Check for answer' }).click();
  await expect(page.getByRole('heading', { name: 'Awaiting a response' })).toBeVisible();

  answer = 'Write to the landlord first and keep a copy.';
  await page.getByRole('button', { name: 'Check for answer' }).click();
  await expect(page.getByRole('heading', { name: 'A legal expert has answered' })).toBeVisible();
  await expect(page.getByText(answer)).toBeVisible();
  expect(page.url()).not.toContain(DATA.code);
});

test('a code that matches nothing explains what to try and cannot be recovered', async ({ page }) => {
  await stubApi(page, {
    'GET /questions/anon/:token': () => reply({ error: 'No question found for this token' }, 404),
  });
  await page.goto('/ask/check');
  await page.getByLabel('Your question code').fill('0000-0000-0000-0000');
  await page.getByRole('button', { name: 'Check for answer' }).click();
  await expect(page.getByText('No question found for this token')).toBeVisible();
  await expect(page.getByText(/lost code cannot be sent or reset/)).toBeVisible();
});

test('the question is kept when the server says to wait', async ({ page }) => {
  await stubApi(page, {
    'POST /questions/anonymous': () => reply({ error: 'Too many attempts. Please wait.' }, 429),
  });
  await page.goto('/ask');
  await page.getByLabel('Your question').fill('A long question I do not want to lose');
  await page.getByLabel('I understand the code cannot be recovered.').check();
  await page.getByRole('button', { name: 'Send my question' }).click();
  await expect(page.getByText('Too many attempts. Please wait.')).toBeVisible();
  await expect(page.getByLabel('Your question')).toHaveValue('A long question I do not want to lose');
});

test('a signed-in student chooses whether the question carries their name', async ({ page }) => {
  await signInAs(page, 'student');
  const api = await stubApi(page, { 'POST /questions': () => ({ id: 4, status: 'open' }) });
  await page.goto('/ask');
  await page.getByLabel('Your question').fill('A question');

  const send = page.getByRole('button', { name: 'Send my question' });
  await expect(send).toBeDisabled();
  await page.getByRole('radio', { name: /With my name/ }).check();
  await send.click();
  // The link is in the menu as well as on the page. Only the one on the page is wanted here.
  await expect(page.getByRole('main').getByRole('link', { name: 'My activity' })).toBeVisible();
  expect(api.sent('POST', '/questions')).toHaveLength(1);
});

test('my activity lists a signed-in question and says anonymous ones never appear', async ({ page }) => {
  await signInAs(page, 'student');
  await stubApi(page, {
    'GET /questions/mine': () => [{ id: 4, text: 'A question', answer: 'An answer', status: 'answered', created_at: '2026-09-02T09:00:00Z' }],
    'GET /bookings/mine': () => [],
  });
  await page.goto('/my-activity');
  await expect(page.getByText('An answer')).toBeVisible();
  await expect(page.getByText(/never listed here/)).toBeVisible();
});

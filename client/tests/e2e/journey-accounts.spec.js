import { test, expect } from '@playwright/test';
import { stubApi, reply, signInAs, openMenu } from './support.js';

// Signing up, signing in, signing out, and what each role may open.

const STUDENT = { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' };

test('sign up is limited to the ALU community and asks the student to check their email', async ({ page }) => {
  const api = await stubApi(page, {
    'POST /auth/register': () => reply({ user: STUDENT, message: 'Account created. Check test.student@alustudent.com for a link to verify your address.' }, 201),
  });
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Test Student');
  await page.getByLabel('ALU email address').fill('someone@example.org');
  await page.getByLabel('Password', { exact: true }).fill('secret-pass');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toContainText('limited to the ALU community');
  expect(api.sent('POST', '/auth/register')).toHaveLength(0);

  await page.getByLabel('ALU email address').fill('test.student@alustudent.com');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  // Signing up does not sign the person in. The link in the email does.
  expect(await page.evaluate(() => localStorage.getItem('alc.token'))).toBeNull();
});

test('a wrong password shows the server message and keeps nothing secret in the box', async ({ page }) => {
  await stubApi(page, { 'POST /auth/login': () => reply({ error: 'Incorrect email or password' }, 401) });
  await page.goto('/login');
  await page.getByLabel('Email').fill('test.student@alustudent.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong-pass-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
});

test('signing in shows the name and signing out ends the session', async ({ page }) => {
  const api = await stubApi(page, {
    'POST /auth/login': () => ({ token: 'tok-test', user: STUDENT }),
    'POST /auth/logout': () => reply(null, 204),
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill('test.student@alustudent.com');
  await page.getByLabel('Password', { exact: true }).fill('secret-pass');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { level: 1, name: /Welcome back/ })).toBeVisible();
  await openMenu(page);
  await expect(page.getByRole('dialog', { name: 'All pages' }).getByText('Test Student')).toBeVisible();
  await page.getByRole('dialog', { name: 'All pages' }).getByRole('button', { name: 'Sign out' }).click();

  await openMenu(page);
  await expect(page.getByRole('dialog', { name: 'All pages' }).getByRole('link', { name: 'Sign in' })).toBeVisible();
  expect(api.sent('POST', '/auth/logout')).toHaveLength(1);
});

test('a student who types an admin address is told they have no permission', async ({ page }) => {
  await signInAs(page, 'student');
  await stubApi(page, {});
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'You do not have permission to open this page' })).toBeVisible();
});

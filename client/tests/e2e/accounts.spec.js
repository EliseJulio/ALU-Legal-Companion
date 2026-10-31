import { test, expect } from '@playwright/test';
import { stubApi, reply, DATA, openMenu } from './support.js';

// Signing in, signing up, verifying an address and resetting a password.

const STUDENT = { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' };

test('a wrong password shows the server message and no hint about the account', async ({ page }) => {
  await stubApi(page, { 'POST /auth/login': () => reply({ error: 'Incorrect email or password' }, 401) });
  await page.goto('/login');
  await page.getByLabel('Email').fill('test.student@alustudent.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong-pass-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password');
  await expect(page.getByText('Need a new link?')).toHaveCount(0);
  // The password does not stay in the box. The address does.
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Email')).toHaveValue('test.student@alustudent.com');
});

test('an address that is not verified yet is offered a new link', async ({ page }) => {
  const api = await stubApi(page, {
    'POST /auth/login': () => reply({ error: 'Your email address is not verified yet.' }, 403),
    'POST /auth/resend-verification': () => ({ message: 'If that address has an account, a new link is on its way.' }),
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill('test.student@alustudent.com');
  await page.getByLabel('Password', { exact: true }).fill('secret-pass');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Send me a new link' }).click();
  await expect(page.getByText(/a new link is on its way/)).toBeVisible();
  expect(api.sent('POST', '/auth/resend-verification')[0].body).toEqual({ email: 'test.student@alustudent.com' });
});

test('signing in shows the name in the header and signing out ends the session', async ({ page }) => {
  const api = await stubApi(page, {
    'POST /auth/login': () => ({ token: 'tok-test', user: STUDENT }),
    'POST /auth/logout': () => reply(null, 204),
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill('test.student@alustudent.com');
  await page.getByLabel('Password', { exact: true }).fill('secret-pass');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/matters$/);
  // On a phone the name sits in the menu. A student sees their own pages there.
  await openMenu(page);
  await expect(page.locator('header').getByText('Test Student')).toBeVisible();
  const matters = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My Matters' });
  await expect(matters).toBeVisible();
  await expect(matters).toHaveAttribute('href', '/matters');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
  expect(api.sent('POST', '/auth/logout')).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('alc.token'))).toBeNull();
});

test('the session survives a reload', async ({ page }) => {
  await stubApi(page, { 'POST /auth/login': () => ({ token: 'tok-test', user: STUDENT }) });
  await page.goto('/login');
  await page.getByLabel('Email').fill('test.student@alustudent.com');
  await page.getByLabel('Password', { exact: true }).fill('secret-pass');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.reload();
  await openMenu(page);
  await expect(page.locator('header').getByText('Test Student')).toBeVisible();
});

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

test('the link in the verification email signs the student in and removes the token from the address', async ({ page }) => {
  await stubApi(page, { 'POST /auth/verify-email': () => ({ token: 'tok-test', user: STUDENT }) });
  await page.goto('/verify-email?token=abc123');
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible();
  expect(page.url()).not.toContain('abc123');
  await openMenu(page);
  await expect(page.locator('header').getByText('Test Student')).toBeVisible();
});

test('a verification link that was already used says why', async ({ page }) => {
  await stubApi(page, {
    'POST /auth/verify-email': () => reply({ error: 'This link has already been used. Try signing in.' }, 400),
  });
  await page.goto('/verify-email?token=abc123');
  await expect(page.getByRole('alert')).toContainText('already been used');
});

test('forgot password gives the same sentence whatever the address', async ({ page }) => {
  await stubApi(page, { 'POST /auth/forgot-password': () => ({ message: 'If that address has an account, a reset link is on its way.' }) });
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill('anyone@example.org');
  await page.getByRole('button', { name: 'Send reset instructions' }).click();
  await expect(page.getByText('If that address has an account, a reset link is on its way.')).toBeVisible();
  await expect(page.getByText(/found/i)).toHaveCount(0);
});

test('a password reset checks the two passwords before it uses the link', async ({ page }) => {
  const api = await stubApi(page, { 'POST /auth/reset-password': () => ({ token: 'tok-test', user: STUDENT }) });
  await page.goto('/reset-password?token=abc123');
  await page.getByLabel('New password', { exact: true }).fill('new-pass-1');
  await page.getByLabel('Confirm new password').fill('new-pass-2');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page.getByRole('alert')).toContainText('not the same');
  expect(api.sent('POST', '/auth/reset-password')).toHaveLength(0);

  await page.getByLabel('Confirm new password').fill('new-pass-1');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page).toHaveURL(/\/matters$/);
  expect(page.url()).not.toContain('abc123');
});

test('the code for an invitation is taken from the link', async ({ page }) => {
  await stubApi(page, {});
  await page.goto(`/redeem-invite?token=${DATA.code}`);
  await expect(page.getByLabel('Invitation')).toHaveValue(DATA.code);
});

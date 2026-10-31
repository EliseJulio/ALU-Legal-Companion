import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from '@/pages/Login';
import { AuthProvider } from '@/lib/AuthContext';
import { clearSession, readSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const SESSION = { token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' } };

const show = (path = '/login') => render(
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/matters" element={<p>My matters page</p>} />
        <Route path="/expert/questions" element={<p>Expert page</p>} />
        <Route path="/admin" element={<p>Admin page</p>} />
        <Route path="/guides/:id" element={<p>The guide page</p>} />
      </Routes>
    </AuthProvider>
  </MemoryRouter>,
);

async function signIn(email, password) {
  const user = userEvent.setup({ delay: null });
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => {
  clearSession();
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(reply(200, SESSION));
});

describe('Sign in', () => {
  it('asks for what is missing and sends nothing', async () => {
    show();
    await signIn('', '');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email and password to sign in.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('says so when the address cannot be an address', async () => {
    show();
    await signIn('not-an-email', 'secret-pass');
    expect(screen.getByRole('alert')).toHaveTextContent('That does not look like an email address.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('signs in with the trimmed address and goes to the start page for the role', async () => {
    show();
    await signIn('  test.student@alustudent.com ', 'secret-pass');
    expect(await screen.findByText('My matters page')).toBeInTheDocument();
    const [url, options] = global.fetch.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/login$/);
    expect(JSON.parse(options.body)).toEqual({ email: 'test.student@alustudent.com', password: 'secret-pass' });
    expect(readSession()).toMatchObject({ name: 'Test Student' });
  });

  it('shows the server message as it is for a wrong password and offers no resend', async () => {
    global.fetch.mockResolvedValue(reply(401, { error: 'Incorrect email or password' }));
    show();
    await signIn('test.student@alustudent.com', 'wrong-pass');
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(screen.queryByText('Need a new link?')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('test.student@alustudent.com');
  });

  it('hides the password again after a try so the next one is not typed in the open', async () => {
    global.fetch.mockResolvedValue(reply(401, { error: 'Incorrect email or password' }));
    show();
    await userEvent.setup({ delay: null }).click(screen.getByRole('checkbox', { name: 'Show password' }));
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text');
    await signIn('test.student@alustudent.com', 'wrong-pass');
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'password');
    expect(screen.getByRole('checkbox', { name: 'Show password' })).not.toBeChecked();
  });

  it('offers a new verification link only when the server says the account is not verified', async () => {
    global.fetch.mockResolvedValueOnce(reply(403, { error: 'Your email address is not verified yet.' }));
    show();
    await signIn('test.student@alustudent.com', 'secret-pass');
    expect(await screen.findByText('Need a new link?')).toBeInTheDocument();

    global.fetch.mockResolvedValueOnce(reply(200, { message: 'If that address has an account, a new link is on its way.' }));
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Send me a new link' }));
    expect(await screen.findByText(/a new link is on its way/)).toBeInTheDocument();
    const [url, options] = global.fetch.mock.calls.at(-1);
    expect(String(url)).toMatch(/\/auth\/resend-verification$/);
    expect(JSON.parse(options.body)).toEqual({ email: 'test.student@alustudent.com' });
  });

  it('always shows the way to reset a password and to create an account', () => {
    show();
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: /Create one with your ALU address/ })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Redeem your invite' })).toHaveAttribute('href', '/redeem-invite');
  });
});

describe('Sign in: where a person goes next', () => {
  const asRole = (role) => {
    global.fetch = vi.fn().mockResolvedValue(reply(200, { token: 'tok-2', user: { id: 2, name: 'Test', email: 'a@example.org', role } }));
  };

  it('goes back to the page the person came from', async () => {
    show('/login?next=%2Fguides%2F3');
    await signIn('test.student@alustudent.com', 'secret-pass');
    expect(await screen.findByText('The guide page')).toBeInTheDocument();
  });

  it('goes to the start page of an expert and of an administrator when nothing was asked for', async () => {
    asRole('legal_expert');
    const first = show();
    await signIn('expert@example.org', 'secret-pass');
    expect(await screen.findByText('Expert page')).toBeInTheDocument();
    first.unmount();
    clearSession();
    asRole('admin');
    show();
    await signIn('admin@example.org', 'secret-pass');
    expect(await screen.findByText('Admin page')).toBeInTheDocument();
  });

  it('ignores a next address that leads to another site and uses the start page instead', async () => {
    for (const bad of ['https%3A%2F%2Fevil.example%2F', '%2F%2Fevil.example', '%2Flogin']) {
      const view = show(`/login?next=${bad}`);
      await signIn('test.student@alustudent.com', 'secret-pass');
      expect(await screen.findByText('My matters page')).toBeInTheDocument();
      view.unmount();
      clearSession();
    }
  });

  it('keeps the next address through a failed try', async () => {
    global.fetch.mockResolvedValueOnce(reply(401, { error: 'Incorrect email or password' }));
    show('/login?next=%2Fguides%2F3');
    await signIn('test.student@alustudent.com', 'wrong-pass');
    await screen.findByRole('alert');
    global.fetch.mockResolvedValue(reply(200, SESSION));
    await signIn('', 'secret-pass');
    expect(await screen.findByText('The guide page')).toBeInTheDocument();
  });
});

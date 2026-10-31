import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import { AuthProvider } from '@/lib/AuthContext';
import { clearSession, readSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const SESSION = { token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' } };
const user = () => userEvent.setup({ delay: null });

beforeEach(() => {
  clearSession();
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(reply(200, { message: 'If that address has an account, a link is on its way.' }));
});

describe('Forgot password', () => {
  const show = () => render(<MemoryRouter><ForgotPassword /></MemoryRouter>);

  it('asks for an address and sends nothing without one', async () => {
    show();
    await user().click(screen.getByRole('button', { name: 'Send reset instructions' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the email address for your account.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('says so when the text cannot be an address', async () => {
    show();
    const u = user();
    await u.type(screen.getByLabelText('Email address'), 'nope');
    await u.click(screen.getByRole('button', { name: 'Send reset instructions' }));
    expect(screen.getByRole('alert')).toHaveTextContent('does not look like an email address');
  });

  it('shows the server sentence as it is and nothing about whether the account exists', async () => {
    show();
    const u = user();
    await u.type(screen.getByLabelText('Email address'), 'anyone@example.org');
    await u.click(screen.getByRole('button', { name: 'Send reset instructions' }));
    expect(await screen.findByText('If that address has an account, a link is on its way.')).toBeInTheDocument();
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ email: 'anyone@example.org' });
    expect(screen.queryByText(/found/i)).not.toBeInTheDocument();
  });
});

describe('Reset password', () => {
  function show(search = '?token=abc123') {
    window.history.pushState(null, '', `/reset-password${search}`);
    return render(
      <MemoryRouter initialEntries={[`/reset-password${search}`]}>
        <AuthProvider>
          <Routes>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<p>Home page</p>} />
            <Route path="/matters" element={<p>My matters page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  async function fill(first, second) {
    const u = user();
    await u.type(screen.getByLabelText('New password'), first);
    await u.type(screen.getByLabelText('Confirm new password'), second);
    await u.click(screen.getByRole('button', { name: 'Reset password' }));
  }

  it('explains a link with no token', () => {
    show('');
    expect(screen.getByRole('heading', { name: 'This link is incomplete' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('does not use up the link on a short password or a typo', async () => {
    show();
    await fill('short', 'short');
    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not use up the link when the two passwords differ', async () => {
    show();
    await fill('secret-pass', 'secret-pasz');
    expect(screen.getByRole('alert')).toHaveTextContent('not the same');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('saves the password, signs in, goes to the start page for the role and removes the token from the address', async () => {
    global.fetch.mockResolvedValue(reply(200, SESSION));
    show();
    await fill('secret-pass', 'secret-pass');
    expect(await screen.findByText('My matters page')).toBeInTheDocument();
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ token: 'abc123', password: 'secret-pass' });
    expect(readSession()).toMatchObject({ name: 'Test Student' });
    expect(window.location.href).not.toMatch(/abc123/);
  });

  it('shows why the link was refused and keeps the token in the address', async () => {
    global.fetch.mockResolvedValue(reply(400, { error: 'This password reset link has expired.' }));
    show();
    await fill('secret-pass', 'secret-pass');
    expect(await screen.findByRole('alert')).toHaveTextContent('has expired');
    expect(readSession()).toBeNull();
    expect(window.location.href).toMatch(/abc123/);
  });
});

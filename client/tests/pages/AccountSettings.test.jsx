import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AccountSettings from '@/pages/AccountSettings';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession, readSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const ME = {
  id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student',
  email_verified_at: '2026-09-01T09:00:00Z', created_at: '2026-09-01T08:00:00Z',
};

function show(role = 'student') {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Student', email: ME.email, role } });
  return render(<MemoryRouter><AuthProvider><AccountSettings /></AuthProvider></MemoryRouter>);
}

const u = () => userEvent.setup({ delay: null });
const sent = (method, path) => global.fetch.mock.calls.filter(([url, o]) => o.method === method && String(url).endsWith(path));

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/auth/me') return reply(200, ME);
    if (options.method === 'PUT' && path === '/auth/me') {
      return reply(200, { token: 'tok-2', user: { id: 1, name: JSON.parse(options.body).name, email: ME.email, role: 'student' } });
    }
    if (path === '/auth/change-email') return reply(200, { message: 'If that address can be used, a confirmation link is on its way to it.' });
    if (path === '/auth/change-password') {
      return reply(200, { token: 'tok-3', user: { id: 1, name: 'Test Student', email: ME.email, role: 'student' } });
    }
    return reply(404, { error: 'unexpected' });
  });
});

describe('Account settings', () => {
  it('asks a visitor to sign in without asking the server', () => {
    show(null);
    expect(screen.getByText('Sign in to manage your account')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows the name, email, role in words and when the account began', async () => {
    show();
    const overview = await screen.findByRole('region', { name: 'Overview' });
    expect(await screen.findByText(/\(confirmed\)/)).toBeInTheDocument();
    expect(overview).toHaveTextContent('test.student@alustudent.com (confirmed)');
    expect(overview).toHaveTextContent('Student');
    expect(overview).toHaveTextContent('Member since');
  });

  it('says in words that an address is not confirmed', async () => {
    global.fetch.mockImplementation(async () => reply(200, { ...ME, email_verified_at: null }));
    show();
    expect(await screen.findByText(/\(not confirmed\)/)).toBeInTheDocument();
  });

  it('shows the server message when the account cannot be loaded', async () => {
    global.fetch.mockImplementation(async () => reply(500, { error: 'The server is busy.' }));
    show();
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
  });

  it('keeps as little as it can and asks for no phone number or address', async () => {
    show();
    await screen.findByRole('region', { name: 'Overview' });
    expect(screen.queryByLabelText(/phone|home address|street|student number/i)).not.toBeInTheDocument();
  });
});

describe('Changing the name', () => {
  it('sends the new name and keeps the new session', async () => {
    const user = u();
    show();
    const box = await screen.findByLabelText('Name');
    await user.clear(box);
    await user.type(box, '  New Name ');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Your name is saved.')).toBeInTheDocument();
    expect(JSON.parse(sent('PUT', '/auth/me')[0][1].body)).toEqual({ name: 'New Name' });
    expect(readSession()).toMatchObject({ name: 'New Name' });
  });

  it('refuses an empty name without sending anything', async () => {
    const user = u();
    show();
    await user.clear(await screen.findByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Your name cannot be empty.');
    expect(sent('PUT', '/auth/me')).toHaveLength(0);
  });
});

describe('Changing the email address', () => {
  async function fill(email, password) {
    const user = u();
    await screen.findByRole('region', { name: 'Overview' });
    if (email) await user.type(screen.getByLabelText('New email address'), email);
    if (password) await user.type(screen.getByLabelText('Your password'), password);
    await user.click(screen.getByRole('button', { name: 'Send confirmation link' }));
  }

  it('asks for the new address first and sends nothing', async () => {
    show();
    await fill('', 'old-pass-1');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the new email address.');
    expect(sent('POST', '/auth/change-email')).toHaveLength(0);
  });

  it('asks for the password and sends nothing without it', async () => {
    show();
    await fill('new.me@alustudent.com', '');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your current password.');
    expect(sent('POST', '/auth/change-email')).toHaveLength(0);
  });

  it('sends the address and password, says what happens next and clears the password', async () => {
    show();
    await fill('new.me@alustudent.com', 'old-pass-1');
    expect(await screen.findByText(/confirmation link is on its way/)).toBeInTheDocument();
    expect(JSON.parse(sent('POST', '/auth/change-email')[0][1].body)).toEqual({
      email: 'new.me@alustudent.com', current_password: 'old-pass-1',
    });
    expect(screen.getByLabelText('Your password')).toHaveValue('');
    expect(screen.getByLabelText('New email address')).toHaveValue('');
    // Nothing changes on screen until the link is used.
    expect(readSession()).toMatchObject({ email: ME.email });
  });

  it('shows the server message for a wrong password and clears the password box', async () => {
    global.fetch.mockImplementation(async (url, options) => {
      const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
      if (options.method === 'GET' && path === '/auth/me') return reply(200, ME);
      return reply(400, { error: 'That password is not correct.' });
    });
    show();
    await fill('new.me@alustudent.com', 'wrong-pass-1');
    expect(await screen.findByText('That password is not correct.')).toBeInTheDocument();
    expect(screen.getByLabelText('Your password')).toHaveValue('');
    expect(readSession()).toMatchObject({ name: 'Test Student' });
  });

  it('shows an address that is waiting for its link', async () => {
    global.fetch.mockImplementation(async (url, options) => {
      const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
      if (options.method === 'GET' && path === '/auth/me') return reply(200, { ...ME, pending_email: 'waiting@alustudent.com' });
      return reply(404, { error: 'unexpected' });
    });
    show();
    const overview = await screen.findByRole('region', { name: 'Overview' });
    expect(await within(overview).findByText(/Waiting for confirmation: waiting@alustudent\.com/)).toBeInTheDocument();
  });

  it('shows no waiting line when no change was asked for', async () => {
    show();
    await screen.findByRole('region', { name: 'Overview' });
    expect(screen.queryByText(/Waiting for confirmation/)).not.toBeInTheDocument();
  });
});

describe('Changing the password', () => {
  async function fill(current, next, again) {
    const user = u();
    await screen.findByRole('region', { name: 'Overview' });
    if (current) await user.type(screen.getByLabelText('Current password'), current);
    if (next) await user.type(screen.getByLabelText('New password'), next);
    if (again) await user.type(screen.getByLabelText('Confirm new password'), again);
    await user.click(screen.getByRole('button', { name: 'Change password' }));
  }

  it('asks for the current password first', async () => {
    show();
    await fill('', 'new-pass-1', 'new-pass-1');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your current password.');
    expect(sent('POST', '/auth/change-password')).toHaveLength(0);
  });

  it('refuses a short new password without sending anything', async () => {
    show();
    await fill('old-pass-1', 'short', 'short');
    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(sent('POST', '/auth/change-password')).toHaveLength(0);
  });

  it('refuses two new passwords that differ', async () => {
    show();
    await fill('old-pass-1', 'new-pass-1', 'new-pass-2');
    expect(screen.getByRole('alert')).toHaveTextContent('not the same');
    expect(sent('POST', '/auth/change-password')).toHaveLength(0);
  });

  it('changes the password keeps the new session and clears all three boxes', async () => {
    show();
    await fill('old-pass-1', 'new-pass-1', 'new-pass-1');
    expect(await screen.findByText(/Your password is changed/)).toBeInTheDocument();
    expect(JSON.parse(sent('POST', '/auth/change-password')[0][1].body)).toEqual({
      current_password: 'old-pass-1', new_password: 'new-pass-1',
    });
    expect(readSession()).toMatchObject({ name: 'Test Student' });
    for (const label of ['Current password', 'New password', 'Confirm new password']) {
      expect(screen.getByLabelText(label)).toHaveValue('');
    }
  });

  it('shows the server message for a wrong current password and clears the boxes', async () => {
    global.fetch.mockImplementation(async (url, options) => {
      const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
      if (options.method === 'GET' && path === '/auth/me') return reply(200, ME);
      return reply(400, { error: 'That password is not correct.' });
    });
    show();
    await fill('wrong-pass-1', 'new-pass-1', 'new-pass-1');
    expect(await screen.findByText('That password is not correct.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    // A typo must never sign the person out.
    expect(readSession()).toMatchObject({ name: 'Test Student' });
  });
});

describe("Account settings: what the page promises", () => {
  it("says the account is separate from shared matter identity", async () => {
    show("student");
    expect(await screen.findByText("Your account stays separate from shared matter identity")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Home / Account settings");
  });
});

describe('Account settings: the page as designed', () => {
  it('is called Account settings and has one Show passwords tick box for the three boxes', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Account settings' })).toBeInTheDocument();
    await screen.findByRole('region', { name: 'Overview' });
    const user = userEvent.setup({ delay: null });
    const tick = screen.getByRole('checkbox', { name: 'Show passwords' });
    expect(screen.getAllByRole('checkbox', { name: /Show password/ })).toHaveLength(1);
    await user.click(tick);
    for (const label of ['Current password', 'New password', 'Confirm new password']) {
      expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('type', 'text');
    }
  });

  it('hides the passwords again after a try', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('region', { name: 'Overview' });
    await user.click(screen.getByRole('checkbox', { name: 'Show passwords' }));
    await user.type(screen.getByLabelText('Current password'), 'old-pass-1');
    await user.type(screen.getByLabelText('New password', { exact: true }), 'new-pass-1');
    await user.type(screen.getByLabelText('Confirm new password'), 'new-pass-1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await screen.findByText(/Your password is changed/);
    expect(screen.getByLabelText('Current password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('checkbox', { name: 'Show passwords' })).not.toBeChecked();
  });

  it('keeps the four facts in a list with small labels', async () => {
    show();
    const overview = within(await screen.findByRole('region', { name: 'Overview' }));
    for (const label of ['Name', 'Email / confirmation', 'Role', 'Member since']) {
      expect(overview.getByText(label)).toBeInTheDocument();
    }
  });
});

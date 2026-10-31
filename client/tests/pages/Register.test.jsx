import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Register from '@/pages/Register';
import { getToken } from '@/lib/api';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const show = () => render(<MemoryRouter><Register /></MemoryRouter>);

async function fill({ name = 'Test Student', email = 'test.student@alustudent.com', password = 'secret-pass' } = {}) {
  const user = userEvent.setup({ delay: null });
  if (name) await user.type(screen.getByLabelText('Your name'), name);
  if (email) await user.type(screen.getByLabelText('ALU email address'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  return user;
}
const submit = (user) => user.click(screen.getByRole('button', { name: 'Create account' }));

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(reply(201, {
    user: { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' },
    message: 'Account created. Check test.student@alustudent.com for a link to verify your address.',
  }));
});

describe('Create an account', () => {
  it('refuses an address outside the ALU community and sends nothing', async () => {
    show();
    const user = await fill({ email: 'someone@example.org' });
    await submit(user);
    expect(screen.getByRole('alert')).toHaveTextContent(/limited to the ALU community/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuses a short password and sends nothing', async () => {
    show();
    const user = await fill({ password: 'short' });
    await submit(user);
    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('asks for a name', async () => {
    show();
    const user = await fill({ name: '' });
    await submit(user);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name.');
  });

  it('sends the chosen role and shows the server message without signing in', async () => {
    show();
    const user = await fill();
    await user.click(screen.getByRole('radio', { name: 'A member of staff' }));
    await submit(user);
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/Check test.student@alustudent.com/)).toBeInTheDocument();
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      name: 'Test Student', email: 'test.student@alustudent.com', password: 'secret-pass', role: 'staff',
    });
    expect(getToken()).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
  });

  it('shows the server message when the address is already used', async () => {
    global.fetch.mockResolvedValue(reply(400, { error: 'An account with this email already exists' }));
    show();
    const user = await fill();
    await submit(user);
    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
});

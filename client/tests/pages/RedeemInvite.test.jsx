import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RedeemInvite from '@/pages/RedeemInvite';
import { AuthProvider } from '@/lib/AuthContext';
import { clearSession, readSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const SESSION = { token: 'tok-1', user: { id: 2, name: 'Test Expert', email: 'expert@example.org', role: 'legal_expert' } };

function show(search = '?token=invite-abc') {
  window.history.pushState(null, '', `/redeem-invite${search}`);
  return render(
    <MemoryRouter initialEntries={[`/redeem-invite${search}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/redeem-invite" element={<RedeemInvite />} />
          <Route path="/expert/questions" element={<p>Expert page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const submit = (u) => u.click(screen.getByRole('button', { name: 'Redeem invitation' }));

beforeEach(() => {
  clearSession();
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(reply(201, SESSION));
});

describe('Redeem an invitation', () => {
  it('fills the code from the link', () => {
    show();
    expect(screen.getByLabelText('Invitation')).toHaveValue('invite-abc');
  });

  it('asks for the code when the link brought none and sends nothing', async () => {
    show('');
    const u = userEvent.setup({ delay: null });
    await submit(u);
    expect(screen.getByRole('alert')).toHaveTextContent('Paste the invitation code');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not use up the invitation on a missing name or a short password', async () => {
    show();
    const u = userEvent.setup({ delay: null });
    await submit(u);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name.');
    await u.type(screen.getByLabelText('Name'), 'Test Expert');
    await u.type(screen.getByLabelText('Password'), 'short');
    await submit(u);
    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not use up the invitation when the two passwords differ', async () => {
    show();
    const u = userEvent.setup({ delay: null });
    await u.type(screen.getByLabelText('Name'), 'Test Expert');
    await u.type(screen.getByLabelText('Password'), 'secret-pass');
    await u.type(screen.getByLabelText('Confirm password'), 'secret-pasz');
    await submit(u);
    expect(screen.getByRole('alert')).toHaveTextContent('The two passwords are not the same.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('creates the account, signs in and opens the expert workspace', async () => {
    show();
    const u = userEvent.setup({ delay: null });
    await u.type(screen.getByLabelText('Name'), 'Test Expert');
    await u.type(screen.getByLabelText('Password'), 'secret-pass');
    await u.type(screen.getByLabelText('Confirm password'), 'secret-pass');
    await submit(u);
    expect(await screen.findByText('Expert page')).toBeInTheDocument();
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      invite_token: 'invite-abc', name: 'Test Expert', password: 'secret-pass',
    });
    expect(readSession()).toMatchObject({ role: 'legal_expert' });
    expect(window.location.href).not.toMatch(/invite-abc/);
  });

  it('shows why an invitation was refused', async () => {
    global.fetch.mockResolvedValue(reply(400, { error: 'This invitation has expired. Ask the admin for a new one.' }));
    show();
    const u = userEvent.setup({ delay: null });
    await u.type(screen.getByLabelText('Name'), 'Test Expert');
    await u.type(screen.getByLabelText('Password'), 'secret-pass');
    await u.type(screen.getByLabelText('Confirm password'), 'secret-pass');
    await submit(u);
    expect(await screen.findByRole('alert')).toHaveTextContent('has expired');
    expect(readSession()).toBeNull();
  });
});

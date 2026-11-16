import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AccountSettings from '@/pages/AccountSettings';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession, readSession } from '@/lib/auth';
import { getToken } from '@/lib/api';
import { readAccountDeleted, clearAccountDeleted } from '@/lib/signedOutNotice';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const ME = (role) => ({
  id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role,
  email_verified_at: '2026-09-01T09:00:00Z', created_at: '2026-09-01T08:00:00Z',
});

function show(role = 'student') {
  clearSession();
  saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role } });
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <AuthProvider>
        <Routes>
          <Route path="/settings" element={<AccountSettings />} />
          <Route path="/" element={<p>Front page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const u = () => userEvent.setup({ delay: null });
const deletes = () => global.fetch.mock.calls.filter(([, o]) => o.method === 'DELETE');

function stub(role, deleteReply) {
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/auth/me') return reply(200, ME(role));
    if (options.method === 'DELETE' && path === '/auth/me') return deleteReply;
    return reply(404, { error: 'unexpected' });
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearAccountDeleted();
});
afterEach(() => clearSession());

describe('Delete my account', () => {
  it('sends nothing until the password is typed and the box is ticked', async () => {
    stub('student', reply(200, { ok: true }));
    show();
    const user = u();
    const button = await screen.findByRole('button', { name: 'Delete my account' });
    await user.click(button);
    await user.type(screen.getByLabelText('Password to confirm'), 'secret-pass');
    await user.click(button);
    expect(deletes()).toHaveLength(0);
  });

  it('sends the password and the confirmation, clears the session and goes to the front page', async () => {
    stub('student', reply(200, { ok: true }));
    show();
    const user = u();
    await user.type(await screen.findByLabelText('Password to confirm'), 'secret-pass');
    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('Front page')).toBeInTheDocument();
    expect(JSON.parse(deletes()[0][1].body)).toEqual({ password: 'secret-pass', confirm: true });
    expect(getToken()).toBeNull();
    expect(readSession()).toBeNull();
    expect(readAccountDeleted()).toBe(true);
  });

  it('shows the server message on a wrong password and stays signed in', async () => {
    stub('student', reply(401, { error: 'That password is not right.' }));
    show();
    const user = u();
    await user.type(await screen.findByLabelText('Password to confirm'), 'wrong-pass');
    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('That password is not right.')).toBeInTheDocument();
    await waitFor(() => expect(deletes()).toHaveLength(1));
    expect(screen.queryByText('Front page')).not.toBeInTheDocument();
  });

  it('gives a legal expert no delete button and tells them to ask an admin', async () => {
    stub('legal_expert', reply(403, { error: 'no' }));
    show('legal_expert');
    expect(await screen.findByText(/ask an admin/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete my account' })).not.toBeInTheDocument();
  });
});

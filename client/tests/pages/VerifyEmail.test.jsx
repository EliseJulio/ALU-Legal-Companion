import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmail from '@/pages/VerifyEmail';
import { AuthProvider } from '@/lib/AuthContext';
import { clearSession, readSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const SESSION = { token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' } };

function show(search = '?token=abc123') {
  window.history.pushState(null, '', `/verify-email${search}`);
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/verify-email${search}`]}>
        <AuthProvider><VerifyEmail /></AuthProvider>
      </MemoryRouter>
    </StrictMode>,
  );
}

beforeEach(() => {
  clearSession();
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(reply(200, SESSION));
});

describe('Verify email', () => {
  it('uses the link once even though React runs the effect twice', async () => {
    show();
    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ token: 'abc123' });
  });

  it('signs the reader in and welcomes them', async () => {
    show();
    expect(await screen.findByText(/Welcome, Test Student/)).toBeInTheDocument();
    expect(readSession()).toMatchObject({ role: 'student' });
  });

  it('removes the spent token from the address bar', async () => {
    show();
    await screen.findByRole('heading', { name: 'Email confirmed' });
    expect(window.location.href).not.toMatch(/abc123/);
  });

  it('shows the server reason when the link is refused', async () => {
    global.fetch.mockResolvedValue(reply(400, { error: 'This verification link has expired. Request a new one.' }));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('has expired');
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
    expect(readSession()).toBeNull();
  });

  it('sends nothing when there is no token in the address', () => {
    show('');
    expect(screen.getByRole('heading', { name: 'This link is incomplete' })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

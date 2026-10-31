import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';
import { getToken, apiGet } from '@/lib/api';

const STUDENT = { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' };

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => {
    if (body === undefined) throw new Error('no body');
    return body;
  },
});

// A small screen that shows who is signed in and has the two buttons.
function Probe() {
  const { user, signIn, signOut } = useAuth();
  return (
    <div>
      <p data-testid="who">{user ? user.name : 'nobody'}</p>
      <button type="button" onClick={() => signIn({ token: 'tok-1', user: STUDENT })}>in</button>
      <button type="button" onClick={signOut}>out</button>
    </div>
  );
}

const mount = () => render(<AuthProvider><Probe /></AuthProvider>);

let fetchMock;
beforeEach(() => {
  clearSession();
  localStorage.clear();
  fetchMock = vi.fn().mockResolvedValue(reply(204));
  global.fetch = fetchMock;
});

describe('AuthProvider', () => {
  it('starts signed out', () => {
    mount();
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');
  });

  it('signs in and keeps the session', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await user.click(screen.getByRole('button', { name: 'in' }));
    expect(screen.getByTestId('who')).toHaveTextContent('Test Student');
    expect(getToken()).toBe('tok-1');
  });

  it('comes back signed in after a reload', () => {
    saveSession({ token: 'tok-1', user: STUDENT });
    mount();
    expect(screen.getByTestId('who')).toHaveTextContent('Test Student');
  });

  it('tells the server when signing out and then clears everything here', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await user.click(screen.getByRole('button', { name: 'in' }));
    await user.click(screen.getByRole('button', { name: 'out' }));

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/logout$/);
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer tok-1');
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');
    expect(getToken()).toBeNull();
    expect(localStorage.getItem('alc.user')).toBeNull();
  });

  it('still signs out here when the server cannot be reached', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await user.click(screen.getByRole('button', { name: 'in' }));
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await user.click(screen.getByRole('button', { name: 'out' }));
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');
    expect(getToken()).toBeNull();
  });

  it('signs out when any request finds that the session has ended', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await user.click(screen.getByRole('button', { name: 'in' }));
    fetchMock.mockResolvedValue(reply(401, { error: 'Invalid or expired session' }));
    await act(async () => { await apiGet('/auth/me').catch(() => {}); });
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');
  });

  it('stays signed in when a request is only refused for the role', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await user.click(screen.getByRole('button', { name: 'in' }));
    fetchMock.mockResolvedValue(reply(403, { error: 'You do not have permission to do that' }));
    await act(async () => { await apiGet('/admin/users').catch(() => {}); });
    expect(screen.getByTestId('who')).toHaveTextContent('Test Student');
  });
});

describe('useAuth', () => {
  it('fails loudly outside the provider', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow();
    quiet.mockRestore();
  });
});

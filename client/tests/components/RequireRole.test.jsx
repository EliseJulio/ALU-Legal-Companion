import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RequireRole from '@/components/RequireRole';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession, readSession } from '@/lib/auth';

function show(role, at = '/') {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: { id: 1, name: 'Test User', email: 'u@example.org', role } });
  return render(
    <MemoryRouter initialEntries={[at]}>
      <AuthProvider>
        <RequireRole roles={['legal_expert']}><p>Staff page</p></RequireRole>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  it('shows the page to the right role', () => {
    show('legal_expert');
    expect(screen.getByText('Staff page')).toBeInTheDocument();
  });

  it('asks a visitor to sign in and has its own heading', () => {
    show(null);
    expect(screen.queryByText('Staff page')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to reach this page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('sends a visitor back to the page they asked for once they have signed in', () => {
    show(null, '/expert/questions');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=%2Fexpert%2Fquestions');
  });

  it('tells another role that nothing is wrong and never signs them out', () => {
    for (const role of ['student', 'staff', 'admin']) {
      const { unmount } = show(role);
      expect(screen.queryByText('Staff page')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'You do not have permission to open this page' })).toBeInTheDocument();
      expect(readSession()).not.toBeNull();
      unmount();
    }
  });
});

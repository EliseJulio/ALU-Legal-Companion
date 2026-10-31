import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StatusPill from '@/components/StatusPill';
import OwnerOnly from '@/components/OwnerOnly';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

describe('StatusPill', () => {
  it('shows words and never the stored code', () => {
    const { rerender } = render(<StatusPill status="closed" />);
    expect(screen.getByText('Finished')).toBeInTheDocument();
    rerender(<StatusPill status="open" />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    rerender(<StatusPill status="requested" />);
    expect(screen.getByText('Requested')).toBeInTheDocument();
  });

  it('shows an unknown status as it is', () => {
    render(<StatusPill status="something_new" />);
    expect(screen.getByText('something_new')).toBeInTheDocument();
  });

  it('shows nothing when there is no status', () => {
    const { container } = render(<StatusPill status={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('OwnerOnly', () => {
  function show(role) {
    clearSession();
    if (role) saveSession({ token: 'tok-1', user: { id: 1, name: 'Test User', email: 'u@example.org', role } });
    return render(
      <MemoryRouter><AuthProvider><OwnerOnly><p>Secret page</p></OwnerOnly></AuthProvider></MemoryRouter>,
    );
  }

  it('shows the page to a student and to staff', () => {
    for (const role of ['student', 'staff']) {
      const { unmount } = show(role);
      expect(screen.getByText('Secret page')).toBeInTheDocument();
      unmount();
    }
  });

  it('asks a visitor to sign in', () => {
    show(null);
    expect(screen.queryByText('Secret page')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('tells an expert or an admin why it is not theirs', () => {
    for (const role of ['legal_expert', 'admin']) {
      const { unmount } = show(role);
      expect(screen.queryByText('Secret page')).not.toBeInTheDocument();
      expect(screen.getByText('Matter tracking is for students and staff')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Where do I take this?' })).toHaveAttribute('href', '/where-to-go');
      unmount();
    }
  });
});

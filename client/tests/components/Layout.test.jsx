import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Layout from '@/components/Layout';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

const USERS = {
  student: { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' },
  expert: { id: 2, name: 'Test Expert', email: 'expert@example.org', role: 'legal_expert' },
  admin: { id: 3, name: 'Test Admin', email: 'admin@example.org', role: 'admin' },
};

function mount(role = null, path = '/') {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: USERS[role] });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><Layout><p>Page body</p></Layout></AuthProvider>
    </MemoryRouter>,
  );
}

describe('Layout', () => {
  it('puts the page inside the main landmark', () => {
    mount();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('main')).toHaveTextContent('Page body');
  });

  it('has a skip link that points at the main landmark and comes first', () => {
    mount();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(document.querySelector('a')).toBe(skip);
  });

  it('shows the disclaimer in the footer on every page', () => {
    mount();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Legal information not legal advice.');
  });

  it('has the banner with the emergency numbers link', () => {
    mount();
    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('link', { name: 'Emergency numbers' }));
  });
});

describe('Layout: one frame for every person and page', () => {
  it('puts the navigation beside the page for a visitor', () => {
    mount(null, '/directory');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Your workspace')).not.toBeInTheDocument();
  });

  it('shows a student their own pages in the same navigation on any page', () => {
    for (const path of ['/', '/guides', '/matters']) {
      const { unmount } = mount('student', path);
      expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'My Matters' })).toBeInTheDocument();
      unmount();
    }
  });

  it('shows an expert and an admin their workspace in the same navigation', () => {
    const { unmount } = mount('expert', '/expert/questions');
    expect(screen.getByText('Expert workspace')).toBeInTheDocument();
    unmount();
    mount('admin', '/admin');
    expect(screen.getByText('Admin workspace')).toBeInTheDocument();
  });

  it('keeps one main landmark and one banner in every case', () => {
    for (const [role, path] of [[null, '/'], ['student', '/matters'], ['expert', '/expert'], ['admin', '/admin']]) {
      const { unmount } = mount(role, path);
      expect(document.querySelectorAll('main')).toHaveLength(1);
      expect(screen.getAllByRole('banner')).toHaveLength(1);
      unmount();
    }
  });

  it('has the disclaimer and the footer links in every case', () => {
    for (const [role, path] of [[null, '/'], ['student', '/matters'], ['expert', '/expert']]) {
      const { unmount } = mount(role, path);
      const footer = within(screen.getByRole('contentinfo'));
      expect(footer.getByText('Legal information not legal advice.')).toBeInTheDocument();
      expect(footer.getByRole('link', { name: 'All emergency contacts' })).toHaveAttribute('href', '/emergency');
      unmount();
    }
  });

  it('names the emergency numbers link once on every page', () => {
    for (const [role, path] of [[null, '/'], ['student', '/matters'], ['expert', '/expert'], ['admin', '/admin']]) {
      const { unmount } = mount(role, path);
      expect(screen.getAllByRole('link', { name: 'Emergency numbers' })).toHaveLength(1);
      unmount();
    }
  });
});

describe('Layout: the menu can be hidden and shown', () => {
  it('hides the menu, keeps the page and the emergency link, and shows it again', async () => {
    const user = userEvent.setup({ delay: null });
    localStorage.clear();
    mount();
    await user.click(screen.getByRole('button', { name: 'Hide menu' }));
    expect(localStorage.getItem('alc.sidebar')).toBe('hidden');
    expect(screen.getByRole('main')).toHaveTextContent('Page body');
    expect(screen.getAllByRole('link', { name: 'Emergency numbers' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Show menu' }));
    expect(screen.getByRole('button', { name: 'Hide menu' })).toBeInTheDocument();
  });

  it('opens narrow when narrow was the last choice', () => {
    localStorage.setItem('alc.sidebar', 'collapsed');
    mount();
    expect(screen.getByRole('button', { name: 'Widen menu' })).toBeInTheDocument();
    localStorage.clear();
  });
});

describe('Layout: the title of the page', () => {
  const BASE = 'ALU Legal Companion';
  function Changing() {
    const [name, setName] = useState('First heading');
    return (
      <>
        <h1>{name}</h1>
        <button type="button" onClick={() => setName('Second heading')}>change</button>
      </>
    );
  }
  const page = (path, children) => render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><Layout>{children}</Layout></AuthProvider>
    </MemoryRouter>,
  );

  it('takes the title of the browser tab from the heading of the page', () => {
    clearSession();
    page('/emergency', <h1>Emergency numbers</h1>);
    expect(document.title).toBe(`Emergency numbers | ${BASE}`);
  });

  it('uses the name of the site alone on the front page', () => {
    clearSession();
    page('/', <h1>Understand your issue. Find your next step.</h1>);
    expect(document.title).toBe(BASE);
  });

  it('uses the name of the site alone when a page has no heading yet', () => {
    clearSession();
    page('/guides', <p>Loading…</p>);
    expect(document.title).toBe(BASE);
  });

  it('follows the heading when it appears or changes after the page has loaded', async () => {
    clearSession();
    page('/guides/3', <Changing />);
    expect(document.title).toBe(`First heading | ${BASE}`);
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'change' }));
    await waitFor(() => expect(document.title).toBe(`Second heading | ${BASE}`));
  });

  it('stops watching when the layout goes away', () => {
    clearSession();
    const { unmount } = page('/emergency', <h1>Emergency numbers</h1>);
    unmount();
    document.title = 'left alone';
    expect(document.title).toBe('left alone');
  });
});

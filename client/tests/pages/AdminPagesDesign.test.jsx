import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';
import AdminGuides from '@/pages/AdminGuides';
import AdminProviders from '@/pages/AdminProviders';
import AdminRoutes from '@/pages/AdminRoutes';
import AdminUsers from '@/pages/AdminUsers';
import AdminInvites from '@/pages/AdminInvites';
import AdminContacts from '@/pages/AdminContacts';

// The titles and notes of the admin pages, as the Figma frames name them. The first line of each
// page says what it is for. The note says the one rule that matters on that page.

const reply = (body) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });

const PAGES = [
  [AdminGuides, 'Guides', 'This is a management workspace', 'Guide records'],
  [AdminProviders, 'Directory entries', 'Every fact is checked', 'Provider records'],
  [AdminRoutes, 'Routes', 'First-office dependency', 'Route records'],
  [AdminUsers, 'People', 'Expert roles cannot be changed', 'Account access'],
  [AdminInvites, 'Invitations', 'Validate the recipient first', 'Sent invitations'],
  [AdminContacts, 'Urgent contacts', 'The page is never empty', null],
];

beforeEach(() => {
  clearSession();
  saveSession({ token: 'tok', user: { id: 3, name: 'Test Admin', email: 'a@example.org', role: 'admin' } });
  global.fetch = vi.fn().mockResolvedValue(reply([]));
});

describe.each(PAGES)('%o', (Page, heading, note, listHeading) => {
  const show = () => render(<MemoryRouter><AuthProvider><Page /></AuthProvider></MemoryRouter>);

  it(`is called ${heading}, with one level-one heading, and the breadcrumb ends there`, async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(`Admin workspace / ${heading}`);
  });

  it(`carries the note "${note}"`, async () => {
    show();
    expect(await screen.findByText(note)).toBeInTheDocument();
  });

  if (listHeading) {
    it(`names its list "${listHeading}"`, async () => {
      show();
      expect(await screen.findByRole('heading', { level: 2, name: listHeading })).toBeInTheDocument();
    });
  }
});

describe('People: switching an account off', () => {
  it('draws Switch off as the filled warning button', async () => {
    global.fetch = vi.fn().mockResolvedValue(reply([
      { id: 9, name: 'Test Student', email: 's@example.org', role: 'student', created_at: '2026-08-01T00:00:00Z', email_verified_at: '2026-08-01T00:00:00Z', deactivated_at: null },
    ]));
    render(<MemoryRouter><AuthProvider><AdminUsers /></AuthProvider></MemoryRouter>);
    expect((await screen.findByRole('button', { name: 'Switch off' })).className).toMatch(/bg-warning-strong/);
  });
});

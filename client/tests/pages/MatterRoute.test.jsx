import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MatterRoute from '@/pages/MatterRoute';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const ROUTE = {
  id: 4,
  title: 'My landlord kept my deposit',
  legal_basis: 'A lease is a contract. Abunzi committees hear contract disputes between individuals.',
  exclusions: 'The amount is above the limit of the committee.',
  steps: ['Write to the landlord', 'Go to the committee', 'Keep a copy of every paper'],
  deadline_days: 30,
  deadline_runs_from: 'the day you left',
  deadline_note: 'Count from the date on your notice.',
  verified_at: '2026-09-02T09:00:00Z',
  first_forum: {
    id: 9, name: 'Example Abunzi Committee', type: 'abunzi', location: 'Kigali', contact: 'Sector office',
    services: 'Mediation.', languages: 'Kinyarwanda', is_free: true, bookable: false,
    last_checked_at: '2026-09-01', stale: false, verified_at: '2026-09-02T09:00:00Z',
  },
};

function show(role) {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: { id: 1, name: 'Test User', email: 'u@example.org', role } });
  return render(
    <MemoryRouter initialEntries={['/where-to-go/4']}>
      <AuthProvider>
        <Routes><Route path="/where-to-go/:id" element={<MatterRoute />} /></Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(reply(200, ROUTE));
});

describe('Matter route page', () => {
  it('asks the server for this matter', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/directory\/routes\/4$/);
  });

  it('shows the office, the law and the steps', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'My landlord kept my deposit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Example Abunzi Committee' })).toBeInTheDocument();
    expect(screen.getByText(/Abunzi committees hear contract disputes/)).toBeInTheDocument();
    expect(screen.getByText(/The amount is above the limit/)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      expect.arrayContaining(['Write to the landlord', 'Go to the committee', 'Keep a copy of every paper']),
    );
  });

  it('gives the deadline its own block with the word deadline in it', async () => {
    show();
    const block = (await screen.findByRole('heading', { name: 'Deadline' })).closest('section');
    expect(block).toHaveTextContent('30 days');
    expect(block).toHaveTextContent('the day you left');
    expect(block).toHaveTextContent('Count from the date on your notice.');
  });

  it('has no deadline block for a matter with no deadline', async () => {
    global.fetch.mockResolvedValue(reply(200, { ...ROUTE, deadline_days: null, deadline_runs_from: null, deadline_note: null }));
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('heading', { name: 'Deadline' })).not.toBeInTheDocument();
  });

  it('shows the disclaimer', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Legal information not legal advice.')).toBeInTheDocument();
  });

  it('offers a visitor a sign in link and no tracking button', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Track this matter' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to start tracking' })).toHaveAttribute('href', '/login?next=%2Fmatters%2Fnew%3Froute%3D4');
  });

  it('offers a student the button that tracks this matter', async () => {
    show('student');
    expect(await screen.findByRole('link', { name: 'Track this matter' })).toHaveAttribute('href', '/matters/new?route=4');
  });

  it('does not offer tracking to an expert and does not ask them to sign in', async () => {
    show('legal_expert');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Track this matter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in to start tracking' })).not.toBeInTheDocument();
    expect(screen.getByText(/Tracking a matter is for students and staff/)).toBeInTheDocument();
  });

  it('shows the way back through a breadcrumb that ends on this matter', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs).toHaveTextContent('Home / Where to Go / My landlord kept my deposit');
    expect(crumbs.querySelector('[aria-current="page"]')).toHaveTextContent('My landlord kept my deposit');
  });

  it('links the official source only when the office has one', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /Open the official page/ })).not.toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });

  it('opens the official source in a new tab and says so', async () => {
    global.fetch.mockResolvedValue(reply(200, { ...ROUTE, first_forum: { ...ROUTE.first_forum, official_source_url: 'https://example.org/abunzi' } }));
    show();
    const link = await screen.findByRole('link', { name: /Open the official page/ });
    expect(link).toHaveAttribute('href', 'https://example.org/abunzi');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent('opens in a new tab');
  });

  it("never makes a link from an official source that is not https", async () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "http://example.org/abunzi", "not a url"]) {
      global.fetch.mockResolvedValue(reply(200, { ...ROUTE, first_forum: { ...ROUTE.first_forum, official_source_url: bad } }));
      const { unmount } = show();
      await screen.findByRole("heading", { level: 1 });
      expect(screen.queryByRole("link", { name: /Open the official page/ })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('says plainly that a matter with no recorded deadline may still have one', async () => {
    global.fetch.mockResolvedValue(reply(200, { ...ROUTE, deadline_days: null, deadline_runs_from: null, deadline_note: null }));
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText(/does not mean there is none/)).toBeInTheDocument();
  });

  it('has no demonstration labels', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(document.body.textContent).not.toMatch(/Demonstration content|Example records|Not validated/);
  });

  it('shows the server message and a way back when the matter is not found', async () => {
    global.fetch.mockResolvedValue(reply(404, { error: 'That matter is not in the directory' }));
    show();
    expect(await screen.findByText('That matter is not in the directory')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'This matter is not available' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to every matter' })).toHaveAttribute('href', '/where-to-go');
  });
  it('leads from the destination to its directory entry', async () => {
    show();
    const link = await screen.findByRole('link', { name: 'View directory entry for Example Abunzi Committee' });
    expect(link).toHaveAttribute('href', '/directory/9');
    // It sits in the dark header with the name of the office, above the details.
    expect(link.parentElement.querySelector('h3')).toHaveTextContent('Example Abunzi Committee');
    expect(link.parentElement).toHaveClass('bg-chrome');
  });

  it('lists the deadline and the contact details with the sources', async () => {
    show();
    const panel = (await screen.findByRole('heading', { name: 'Sources & review' })).closest('section');
    const term = (name) => [...panel.querySelectorAll('dt')].find((dt) => dt.textContent === name).nextElementSibling;
    expect(term('Deadline')).toHaveTextContent('30 days from the day you left');
    expect(term('Contact details')).toHaveTextContent('Sector office');
  });

  it('says in words when no deadline and no contact details are recorded', async () => {
    global.fetch.mockResolvedValue(reply(200, {
      ...ROUTE, deadline_days: null, deadline_runs_from: null, deadline_note: null,
      first_forum: { ...ROUTE.first_forum, contact: null },
    }));
    show();
    const panel = (await screen.findByRole('heading', { name: 'Sources & review' })).closest('section');
    expect(panel).toHaveTextContent('No deadline has been recorded.');
    expect(panel).toHaveTextContent('No contact details have been recorded.');
  });

  it('puts what does not apply in a callout called Know the limits', async () => {
    show();
    const title = await screen.findByText('Know the limits');
    expect(title.parentElement).toHaveTextContent('The amount is above the limit of the committee.');
  });

  it('has no Know the limits callout when nothing is excluded', async () => {
    global.fetch.mockResolvedValue(reply(200, { ...ROUTE, exclusions: null }));
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText('Know the limits')).not.toBeInTheDocument();
  });
});

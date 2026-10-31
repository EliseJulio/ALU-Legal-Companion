import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SavedGuides from '@/pages/SavedGuides';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const SAVED = [
  { id: 1, domain: 'tenancy', title: 'Getting your deposit back', source_law: 'Law No. 00/0000', status: 'published', verified_at: '2026-09-02T09:00:00Z' },
  { id: 2, domain: 'employment', title: 'Your written contract', source_law: 'Order No. 00/00', status: 'published', verified_at: '2026-09-03T09:00:00Z' },
];

function show(role) {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: { id: 1, name: 'Test User', email: 'a@example.org', role } });
  return render(<MemoryRouter><AuthProvider><SavedGuides /></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(reply(200, SAVED));
});

describe('Saved guides', () => {
  it('lists the saved guides in the order the server sent them', async () => {
    show('student');
    const links = await screen.findAllByRole('link', { name: /^(Getting your deposit back|Your written contract)/ });
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/guides/1', '/guides/2']);
  });

  it('explains that a guide can show as under review for a while', async () => {
    show('student');
    await screen.findAllByRole('link', { name: /^(Getting your deposit back|Your written contract)/ });
    expect(screen.getByText(/The save itself is never lost/)).toBeInTheDocument();
  });

  it('shows an under-review placeholder, not a link, for a guide that is no longer published', async () => {
    global.fetch.mockResolvedValue(reply(200, [
      { ...SAVED[0], status: 'draft' },
      SAVED[1],
    ]));
    show('student');
    await screen.findByRole('link', { name: /^Your written contract/ });
    expect(screen.getAllByText('Getting your deposit back').length).toBeGreaterThan(0);
    expect(screen.getByText(/This guide is currently under review and will be visible again shortly/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Getting your deposit back/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Remove from saved/ })).toHaveLength(2);
  });

  it('shows a withdrawn placeholder, distinct from under review, for a withdrawn guide', async () => {
    global.fetch.mockResolvedValue(reply(200, [{ ...SAVED[0], status: 'withdrawn' }, SAVED[1]]));
    show('student');
    await screen.findByRole('link', { name: /^Your written contract/ });
    expect(screen.getByText('This guide has been withdrawn.')).toBeInTheDocument();
    expect(screen.queryByText(/currently under review/)).not.toBeInTheDocument();
  });

  it('points to the library when nothing is saved', async () => {
    global.fetch.mockResolvedValue(reply(200, []));
    show('staff');
    expect(await screen.findByText('You have not saved any guides yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the guides' })).toHaveAttribute('href', '/guides');
  });

  it('shows the server message when the list cannot be loaded', async () => {
    global.fetch.mockResolvedValue(reply(500, { error: 'The server is busy.' }));
    show('student');
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
  });

  it('asks a visitor to sign in without asking the server', () => {
    show(null);
    expect(screen.getByText('Sign in to see your saved guides.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('explains to an expert or admin that nothing is wrong and does not ask the server', () => {
    for (const role of ['legal_expert', 'admin']) {
      const { unmount } = show(role);
      expect(screen.getByText('Saved guides are for student and staff accounts.')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      unmount();
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("Saved guides: what the page promises", () => {
  it("says a saved guide is not necessarily current", async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, headers: { get: () => null }, json: async () => [] });
    show("student");
    expect(await screen.findByText("Saved does not mean current")).toBeInTheDocument();
    expect(screen.getByText(/Saving keeps your reference, not a legal guarantee/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Legal Guides →" })).toHaveAttribute("href", "/guides");
  });
});

describe('Saved Resources: the page as designed', () => {
  it('is called Saved Resources, like the menu link, and says it is private', async () => {
    show('student');
    expect(await screen.findByRole('heading', { level: 1, name: 'Saved Resources' })).toBeInTheDocument();
    expect(screen.getByText(/Only visible in your own workspace/)).toBeInTheDocument();
  });

  it('takes a guide off the list when Remove from saved is pressed, and says so', async () => {
    const user = userEvent.setup({ delay: null });
    global.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (options.method === 'DELETE') return { ok: true, status: 204, headers: { get: () => null } };
      return reply(200, global.fetch.removed ? [SAVED[1]] : SAVED);
    });
    show('student');
    await screen.findAllByRole('button', { name: /^Remove from saved/ });
    global.fetch.removed = true;
    await user.click(screen.getAllByRole('button', { name: /^Remove from saved/ })[0]);
    expect(await screen.findByText(/Removed “Getting your deposit back” from your saved list/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('link', { name: /^Getting your deposit back/ })).toBeNull());
    expect(screen.getByRole('link', { name: /^Your written contract/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveFocus();
    expect(global.fetch.mock.calls.some(([u, o]) => o.method === 'DELETE' && String(u).endsWith('/guides/1/bookmark'))).toBe(true);
  });
});

describe('Saved Resources: the table on a wide screen', () => {
  const original = window.matchMedia;
  beforeEach(() => { window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })); });
  afterEach(() => { window.matchMedia = original; });

  it('is a table of guide, category, status and actions with one Read guide link in each row', async () => {
    show('student');
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Guide', 'Category', 'Status', 'Actions']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('link', { name: 'Read guide Getting your deposit back' })).toHaveAttribute('href', '/guides/1');
    expect(within(table).getByText('Renting')).toBeInTheDocument();
    expect(within(table).getAllByText('Private save')).toHaveLength(2);
    expect(within(table).getAllByRole('button', { name: /^Remove from saved/ })).toHaveLength(2);
  });

  it('shows "Under review" and no read link in the status/actions cells for an unpublished saved guide', async () => {
    global.fetch.mockResolvedValue(reply(200, [{ ...SAVED[0], status: 'draft' }, SAVED[1]]));
    show('student');
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Under review')).toBeInTheDocument();
    expect(within(table).getByText(/This guide is currently under review and will be visible again shortly/)).toBeInTheDocument();
    expect(within(table).queryByRole('link', { name: /Getting your deposit back/ })).not.toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Read guide Your written contract' })).toHaveAttribute('href', '/guides/2');
  });
});

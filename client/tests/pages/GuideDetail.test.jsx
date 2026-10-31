import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GuideDetail from '@/pages/GuideDetail';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const GUIDE = {
  id: 3,
  domain: 'tenancy',
  title: 'Getting your deposit back',
  situation: 'Your landlord keeps your deposit.',
  law_says: 'A lease is a contract.',
  your_rights: 'You can ask for it back.',
  steps: 'Write a letter.\nKeep a copy.',
  get_help: 'Go to the Abunzi committee.',
  source_law: 'Law No. 00/0000',
  source_url: 'https://example.org/law',
  verified_at: '2026-09-02T09:00:00Z',
};

let guideReply;
let bookmarksReply;

function serve() {
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/guides/3') return guideReply();
    if (options.method === 'GET' && path === '/bookmarks') return bookmarksReply();
    return options.method === 'DELETE' ? { ok: true, status: 204, headers: { get: () => null } } : reply(201, {});
  });
}

const sent = (method) => global.fetch.mock.calls.filter(([url, o]) => o.method === method && String(url).endsWith('/guides/3/bookmark'));
const asked = (path) => global.fetch.mock.calls.some(([url]) => String(url).endsWith(path));

function show(role) {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: { id: 1, name: 'Test User', email: 'a@example.org', role } });
  return render(
    <MemoryRouter initialEntries={['/guides/3']}>
      <AuthProvider>
        <Routes><Route path="/guides/:id" element={<GuideDetail />} /></Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  guideReply = async () => reply(200, GUIDE);
  bookmarksReply = async () => reply(200, []);
  serve();
});

describe('Guide detail', () => {
  it('shows the five parts and the source law', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Getting your deposit back' })).toBeInTheDocument();
    for (const heading of ['Your situation', 'What the law says', 'Your rights', 'Steps to take', 'Where to get help']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('Law No. 00/0000')).toBeInTheDocument();
    const law = screen.getByRole('link', { name: /Read the full law/ });
    expect(law).toHaveAttribute('href', 'https://example.org/law');
    expect(law).toHaveAccessibleName('Read the full law (opens in a new tab)');
  });

  it('shows the how-to part when the guide has one, and nothing extra when it has none', async () => {
    guideReply = async () => reply(200, { ...GUIDE, service: { fees: [{ item: 'Permit', amount_rwf: 20000 }], documents: [{ name: 'Passport page' }] } });
    const { unmount } = show();
    expect(await screen.findByRole('heading', { name: 'How to do it' })).toBeInTheDocument();
    expect(screen.getByText('FRW 20,000')).toBeInTheDocument();
    unmount();
    guideReply = async () => reply(200, { ...GUIDE, service: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('heading', { name: 'How to do it' })).not.toBeInTheDocument();
  });

  it('never makes a link from an address that is not https', async () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'http://example.org/law', 'not a url']) {
      guideReply = async () => reply(200, { ...GUIDE, source_url: bad });
      const { unmount } = show();
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByRole('link', { name: /Read the full law/ })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('lists the five parts as links that jump to them', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    const contents = screen.getByRole('navigation', { name: 'In this guide' });
    const links = [...contents.querySelectorAll('a')];
    expect(links.map((a) => a.textContent)).toEqual(['Your situation', 'What the law says', 'Your rights', 'Steps to take', 'Where to get help']);
    for (const a of links) expect(document.getElementById(a.getAttribute('href').slice(1))).toBeInTheDocument();
  });

  it('ends on a breadcrumb that names this guide', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Home / Legal Guides / Getting your deposit back');
  });

  it('offers the next steps: a legal expert, the routes and the directory', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: 'Ask a legal expert' })).toHaveAttribute('href', '/ask');
    expect(screen.getByRole('link', { name: 'Browse routes' })).toHaveAttribute('href', '/where-to-go');
    expect(screen.getByRole('link', { name: 'Browse the Directory' })).toHaveAttribute('href', '/directory');
  });

  it('shows a visitor how to start saving and shows an expert nothing', async () => {
    const { unmount } = show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: 'Sign in to save guide' })).toHaveAttribute('href', '/login?next=%2Fguides%2F3');
    unmount();
    show('legal_expert');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /Sign in to save/ })).not.toBeInTheDocument();
  });

  it('has no demonstration labels', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(document.body.textContent).not.toMatch(/Example guide|Source link unavailable|not been validated/);
  });

  it('shows the summary under the meta line when the guide has one', async () => {
    guideReply = async () => reply(200, { ...GUIDE, summary: 'What to do when a landlord keeps a deposit.' });
    show();
    expect(await screen.findByText('What to do when a landlord keeps a deposit.')).toBeInTheDocument();
  });

  it('shows no summary line when the guide has none', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/What to do when/)).not.toBeInTheDocument();
  });

  it('shows the disclaimer', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Legal information not legal advice.')).toBeInTheDocument();
  });

  it('shows the crisis numbers on a harassment guide and not on others', async () => {
    guideReply = async () => reply(200, { ...GUIDE, domain: 'harassment' });
    const { unmount } = show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: /3029/ })).toHaveAttribute('href', 'tel:3029');
    unmount();

    guideReply = async () => reply(200, GUIDE);
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /3029/ })).not.toBeInTheDocument();
  });

  it('explains a guide that is being re-checked and keeps the way to the library', async () => {
    guideReply = async () => reply(404, { error: 'Guide not found' });
    show();
    expect(await screen.findByRole('heading', { name: 'This guide is being re-checked' })).toBeInTheDocument();
    expect(screen.getByText(/stops anyone reading law that nobody has verified/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all guides' })).toHaveAttribute('href', '/guides');
  });

  it('shows the withdrawal reason for a withdrawn guide, not the re-checked explanation', async () => {
    guideReply = async () => reply(410, { error: 'Superseded by a new law.' });
    show();
    expect(await screen.findByRole('heading', { name: 'This guide has been withdrawn' })).toBeInTheDocument();
    expect(screen.getByText('Superseded by a new law.')).toBeInTheDocument();
    expect(screen.queryByText(/being re-checked/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all guides' })).toHaveAttribute('href', '/guides');
  });

  it('shows the server message for any other error', async () => {
    guideReply = async () => reply(500, { error: 'The server is busy.' });
    show();
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
    expect(screen.queryByText('This guide is being re-checked')).not.toBeInTheDocument();
  });
});

describe('Saving a guide', () => {
  it('offers a student the save button and saves', async () => {
    const user = userEvent.setup({ delay: null });
    show('student');
    await user.click(await screen.findByRole('button', { name: 'Save guide' }));
    expect(await screen.findByRole('button', { name: 'Remove from saved' })).toBeInTheDocument();
    expect(sent('POST')).toHaveLength(1);
  });

  it('starts as saved when the guide is already in the saved list', async () => {
    bookmarksReply = async () => reply(200, [{ id: 3 }]);
    show('staff');
    expect(await screen.findByRole('button', { name: 'Remove from saved' })).toBeInTheDocument();
  });

  it('removes a save', async () => {
    bookmarksReply = async () => reply(200, [{ id: 3 }]);
    const user = userEvent.setup({ delay: null });
    show('student');
    await user.click(await screen.findByRole('button', { name: 'Remove from saved' }));
    expect(await screen.findByRole('button', { name: 'Save guide' })).toBeInTheDocument();
    expect(sent('DELETE')).toHaveLength(1);
  });

  it('treats "you had not saved it" on remove as done', async () => {
    global.fetch.mockImplementation(async (url) => {
      const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
      if (path === '/guides/3') return reply(200, GUIDE);
      if (path === '/bookmarks') return reply(200, [{ id: 3 }]);
      return reply(404, { error: 'You have not saved this guide' });
    });
    const user = userEvent.setup({ delay: null });
    show('student');
    await user.click(await screen.findByRole('button', { name: 'Remove from saved' }));
    expect(await screen.findByRole('button', { name: 'Save guide' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the server message when saving is refused', async () => {
    global.fetch.mockImplementation(async (url) => {
      const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
      if (path === '/guides/3') return reply(200, GUIDE);
      if (path === '/bookmarks') return reply(200, []);
      return reply(404, { error: 'Guide not found' });
    });
    const user = userEvent.setup({ delay: null });
    show('student');
    await user.click(await screen.findByRole('button', { name: 'Save guide' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Guide not found');
    expect(screen.getByRole('button', { name: 'Save guide' })).toBeInTheDocument();
  });

  it('keeps the guide and starts at "Save" when the saved list cannot be read', async () => {
    bookmarksReply = async () => reply(500, { error: 'Nope' });
    show('student');
    expect(await screen.findByRole('button', { name: 'Save guide' })).toBeInTheDocument();
    expect(screen.queryByText('Nope')).not.toBeInTheDocument();
  });

  it('gives a visitor no save button and never asks for the saved list', async () => {
    show(null);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /Save guide|Remove from saved/ })).not.toBeInTheDocument();
    expect(asked('/bookmarks')).toBe(false);
  });

  it('gives an expert no save button and never asks for the saved list', async () => {
    show('legal_expert');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /Save guide/ })).not.toBeInTheDocument();
    expect(asked('/bookmarks')).toBe(false);
  });
  it('shows the contents as a card with the links one under another', async () => {
    show();
    const nav = await screen.findByRole('navigation', { name: 'In this guide' });
    expect(nav.parentElement).toHaveClass('rounded-card', 'border', 'xl:border-0');
    expect(nav.querySelector('ul')).toHaveClass('flex-col');
  });

  it('shows Sign in to save guide as an outlined button with its reason beneath', async () => {
    show();
    const link = await screen.findByRole('link', { name: 'Sign in to save guide' });
    expect(link).toHaveClass('border-primary', 'w-full');
    expect(screen.getByText('Sign in to save this guide to your account.')).toBeInTheDocument();
  });
});

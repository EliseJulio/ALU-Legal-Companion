import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminChecklists from '@/pages/AdminChecklists';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const list = (over) => ({
  id: 1, slug: 'buying-a-car', title: 'Buying a car', status: 'draft',
  items: [{ key: 'a', name: 'A' }, { key: 'b', name: 'B' }], ...over,
});

let lists;
beforeEach(() => {
  lists = [list({})];
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/checklists/all') return reply(200, lists);
    if (options.method === 'POST' && path === '/checklists/1/publish') {
      lists = lists.map((l) => ({ ...l, status: 'published' }));
      return reply(200, { id: 1, status: 'published' });
    }
    return reply(404, { error: 'unexpected' });
  });
});

const show = () => render(<MemoryRouter><AdminChecklists /></MemoryRouter>);

describe('Document checklists (admin)', () => {
  it('lists every checklist with its state in words and how many documents it has', async () => {
    lists = [list({}), list({ id: 2, title: 'Renewing a permit', status: 'published', items: [{ key: 'a', name: 'A' }] })];
    show();
    expect(await screen.findByRole('heading', { name: 'Buying a car' })).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('2 documents')).toBeInTheDocument();
    expect(screen.getByText('1 document')).toBeInTheDocument();
  });

  it('publishes a draft and shows the new state', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Published')).toBeInTheDocument();
    expect(global.fetch.mock.calls.some(([url, o]) => o.method === 'POST' && String(url).endsWith('/checklists/1/publish'))).toBe(true);
  });

  it('offers no publish control once a checklist is already published', async () => {
    lists = [list({ id: 2, status: 'published', title: 'Live' })];
    show();
    await screen.findByRole('heading', { name: 'Live' });
    expect(screen.queryByRole('button', { name: /publish|verify/i })).not.toBeInTheDocument();
  });

  it('links to a new checklist and to each one for editing', async () => {
    show();
    expect(await screen.findByRole('link', { name: 'Write a new checklist' })).toHaveAttribute('href', '/admin/checklists/new');
    expect(screen.getByRole('link', { name: 'Edit Buying a car' })).toHaveAttribute('href', '/admin/checklists/1');
  });

  it('says so when there are none, and shows the server message when it cannot load', async () => {
    lists = [];
    const { unmount } = show();
    expect(await screen.findByText('There are no checklists yet.')).toBeInTheDocument();
    unmount();
    global.fetch.mockImplementation(async () => reply(500, { error: 'The server is busy.' }));
    show();
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
  });
});

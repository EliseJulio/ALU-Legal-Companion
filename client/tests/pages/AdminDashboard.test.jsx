import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from '@/pages/AdminDashboard';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const STATS = {
  guides: { draft: 2, pending_review: 3, published: 5 },
  directory: {
    providers: { draft: 1, pending_review: 4, published: 6 },
    routes: { draft: 0, pending_review: 2, published: 7 },
    stale: 1,
  },
  bookings: { total: 10, anonymous: 6, by_status: { requested: 3, accepted: 4, declined: 1, completed: 2 } },
  questions: { total: 20, anonymous: 15, open: 8 },
  matters: { total: 12, open: 9, shared: 2 },
  reminders: { pending: 4, sent: 11, missed: 1, cancelled: 2, sent_late: 0 },
  users: { student: 30, staff: 5, legal_expert: 2, admin: 1, deactivated: 3 },
};

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(reply(200, STATS));
});

const show = () => render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
const group = async (name) => within(await screen.findByRole('region', { name }));

describe('Admin dashboard', () => {
  it('shows what is waiting for review in words', async () => {
    show();
    const guides = await group('Guides');
    expect(guides.getByText('Draft').nextSibling).toHaveTextContent('2');
    expect(guides.getByText('Waiting for review').nextSibling).toHaveTextContent('3');
    expect(guides.getByText('Published').nextSibling).toHaveTextContent('5');
  });

  it('shows how many entries have gone stale', async () => {
    show();
    const entries = await group('Directory entries');
    expect(entries.getByText('Not re-checked for six months').nextSibling).toHaveTextContent('1');
  });

  it('shows appointments, questions, matters, reminders and people as counts', async () => {
    show();
    expect((await group('Appointments')).getByText('Accepted').nextSibling).toHaveTextContent('4');
    expect((await group('Questions')).getByText('Still open').nextSibling).toHaveTextContent('8');
    expect((await group('Tracked matters')).getByText('Shared with an expert').nextSibling).toHaveTextContent('2');
    expect((await group('Reminders')).getByText('Sent after the deadline').nextSibling).toHaveTextContent('0');
    expect((await group('People')).getByText('Switched off').nextSibling).toHaveTextContent('3');
  });

  it('links the groups to the pages that manage them', async () => {
    show();
    await screen.findByRole('region', { name: 'Guides' });
    expect(screen.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/admin/guides');
    expect(screen.getByRole('link', { name: 'Directory entries' })).toHaveAttribute('href', '/admin/providers');
    expect(screen.getByRole('link', { name: 'Routes' })).toHaveAttribute('href', '/admin/routes');
    expect(screen.getByRole('link', { name: 'People' })).toHaveAttribute('href', '/admin/users');
  });

  it('names no person and gives no email', async () => {
    show();
    await screen.findByRole('region', { name: 'Guides' });
    expect(document.body.textContent).not.toMatch(/@/);
  });

  it('shows the server message when the counts cannot be loaded', async () => {
    global.fetch.mockResolvedValue(reply(500, { error: 'The server is busy.' }));
    show();
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
  });
});

describe('Admin overview: the page as designed', () => {
  it('is called Overview and says it shows counts and no private activity', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText(/No private questions, case details or individual activity/)).toBeInTheDocument();
  });

  it('says the admin publishes and what invitations are for', async () => {
    show();
    await screen.findByRole('region', { name: 'Guides' });
    expect(screen.getByText(/Admins write, check and publish content/)).toBeInTheDocument();
  });
});

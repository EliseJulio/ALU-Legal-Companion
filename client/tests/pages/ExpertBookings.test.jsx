import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ExpertBookings from '@/pages/ExpertBookings';
import { rows } from '../rows';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

let bookings;
let statusReply;

beforeEach(() => {
  bookings = [
    { id: 1, slot: '2099-01-01T08:00:00.000Z', topic: 'My deposit', status: 'requested', requester: 'Anonymous', meet_link: null },
    { id: 2, slot: '2099-02-01T08:00:00.000Z', topic: null, status: 'accepted', requester: 'Test Student', meet_link: null },
    { id: 3, slot: '2099-03-01T08:00:00.000Z', topic: null, status: 'completed', requester: 'Anonymous', meet_link: null },
    { id: 4, slot: '2099-04-01T08:00:00.000Z', topic: null, status: 'declined', requester: 'Anonymous', meet_link: null },
  ];
  statusReply = async () => reply(200, {});
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/bookings/expert') return reply(200, bookings);
    if (options.method === 'POST' && /\/bookings\/\d+\/status$/.test(path)) return statusReply(path, options);
    return reply(404, { error: 'unexpected' });
  });
});

const show = () => render(<MemoryRouter><ExpertBookings /></MemoryRouter>);
const card = async (name) => within((await screen.findByText(name)).closest('li'));

describe('Expert appointments', () => {
  it('prints the requester exactly as the server sends it', async () => {
    show();
    await screen.findByText('Test Student');
    expect(screen.getAllByText('Anonymous').length).toBeGreaterThan(0);
    expect(screen.getByText('Test Student')).toBeInTheDocument();
  });

  it('offers accept and decline on a request', async () => {
    show();
    await screen.findByText('Test Student');
    const first = within(rows()[0]);
    expect(first.getByRole('button', { name: /^Accept this time/ })).toBeInTheDocument();
    expect(first.getByRole('button', { name: /^Decline/ })).toBeInTheDocument();
  });

  it('offers completed and decline on an accepted booking', async () => {
    show();
    const accepted = await card('Test Student');
    expect(accepted.getByRole('button', { name: /^Mark as completed/ })).toBeInTheDocument();
    expect(accepted.getByRole('button', { name: /^Decline/ })).toBeInTheDocument();
  });

  it('offers nothing on a booking that is over', async () => {
    show();
    await screen.findByText('Test Student');
    const items = rows();
    expect(within(items[2]).queryByRole('button')).not.toBeInTheDocument();
    expect(within(items[3]).queryByRole('button')).not.toBeInTheDocument();
  });

  it('warns when an accepted booking has no video room', async () => {
    show();
    expect(await screen.findByText(/No video room is set for you yet/)).toBeInTheDocument();
  });

  it('reminds the expert to keep host must admit on', async () => {
    show();
    await screen.findByText('Test Student');
    expect(screen.getByText(/host must admit/)).toBeInTheDocument();
  });

  it('sends the chosen status', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByText('Test Student');
    await user.click(within(rows()[0]).getByRole('button', { name: /^Accept this time/ }));
    const [[url, options]] = global.fetch.mock.calls.filter(([, o]) => o.method === 'POST');
    expect(String(url)).toMatch(/\/bookings\/1\/status$/);
    expect(JSON.parse(options.body)).toEqual({ status: 'accepted' });
  });

  it('shows the server message when a time clashes', async () => {
    statusReply = async () => reply(409, { error: 'You already have an accepted booking at that time.' });
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByText('Test Student');
    await user.click(within(rows()[0]).getByRole('button', { name: /^Accept this time/ }));
    expect(await screen.findByText('You already have an accepted booking at that time.')).toBeInTheDocument();
  });

  it('explains an empty list and the likely cause', async () => {
    bookings = [];
    show();
    expect(await screen.findByText(/linked to your directory entry/)).toBeInTheDocument();
  });
});

describe('Expert appointments: the page as designed', () => {
  it('names the three groups and says what the page is for', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Your consultation requests.' })).toBeInTheDocument();
    for (const name of ['Pending requests', 'Accepted appointments', 'Earlier requests']) {
      expect(await screen.findByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByText(/Only requests for your linked provider/)).toBeInTheDocument();
  });

  it('tells the expert who is emailed when they accept and who is not', async () => {
    show();
    expect(await screen.findByText(/a person who signed in is emailed the time and your meeting link/)).toBeInTheDocument();
    expect(screen.getByText(/A person who asked anonymously has no address and checks with their code/)).toBeInTheDocument();
  });

  it('puts each booking in the group for its status', async () => {
    show();
    await screen.findByText('Test Student');
    const group = (name) => within(screen.getByRole('region', { name }));
    expect(group('Pending requests').getAllByRole('listitem')).toHaveLength(1);
    expect(group('Accepted appointments').getAllByRole('listitem')).toHaveLength(1);
    expect(group('Earlier requests').getAllByRole('listitem')).toHaveLength(2);
    expect(group('Accepted appointments').getByText('Test Student')).toBeInTheDocument();
  });

  it('gives the expert the video room of an accepted appointment, as a link that opens a new tab', async () => {
    bookings[1].meet_link = 'https://meet.google.com/abc-defg-hij';
    show();
    const link = await screen.findByRole('link', { name: /Open the meeting/ });
    expect(link).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
    expect(link).toHaveAccessibleName('Open the meeting (opens in a new tab)');
    expect(screen.queryByText(/No video room is set for you yet/)).toBeNull();
  });

  it('never makes a link of a room address that is not https', async () => {
    bookings[1].meet_link = 'javascript:alert(1)';
    show();
    await screen.findByText('Test Student');
    expect(screen.queryByRole('link', { name: /Open the meeting/ })).toBeNull();
    expect(screen.getByText(/No video room is set for you yet/)).toBeInTheDocument();
  });

  it('says in words when a group has nothing in it', async () => {
    bookings = [bookings[1]];
    show();
    expect(await screen.findByText('No requests are waiting for you.')).toBeInTheDocument();
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
  });

  it('keeps the host must admit warning beside the accepted appointments', async () => {
    show();
    await screen.findByText('Test Student');
    expect(within(screen.getByRole('region', { name: 'Accepted appointments' })).getByText('Host admission required')).toBeInTheDocument();
  });
});

describe('Expert appointments: exact words and button names', () => {
  it('prints an anonymous requester exactly as the server sends it, hash and all', async () => {
    bookings[0].requester = 'anonymous (ab12…)';
    show();
    expect(await screen.findByText('anonymous (ab12…)')).toBeInTheDocument();
  });

  it('names each decision button by the request it belongs to', async () => {
    show();
    await screen.findByText('Test Student');
    const accept = within(rows()[0]).getByRole('button', { name: /^Accept this time/ });
    expect(accept).toHaveAccessibleName(/^Accept this time for .*2099/);
  });

  it('puts the host admission warning before the accepted appointments', async () => {
    show();
    await screen.findByText('Test Student');
    const region = screen.getByRole('region', { name: 'Accepted appointments' });
    const warning = within(region).getByText('Host admission required');
    const list = within(region).getAllByRole('listitem')[0];
    expect(warning.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Directory from '@/pages/Directory';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const PROVIDERS = [
  { id: 1, name: 'Example Pro Bono Lawyer', type: 'pro_bono_lawyer', is_free: true, bookable: true },
  { id: 2, name: 'Example Legal Aid Office', type: 'maj_office', is_free: true, bookable: false },
];

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(reply(200, PROVIDERS));
});

const show = (path = '/directory') => render(
  <MemoryRouter initialEntries={[path]}><Directory /></MemoryRouter>,
);
const lastUrl = () => String(global.fetch.mock.calls.at(-1)[0]);

describe('Directory', () => {
  it('lists the entries in the order the server sent them', async () => {
    show();
    const names = await screen.findAllByRole('heading', { level: 3 });
    expect(names.map((h) => h.textContent)).toEqual(['Example Pro Bono Lawyer', 'Example Legal Aid Office']);
    expect(lastUrl()).toMatch(/\/directory\/providers$/);
  });

  it('offers All and the three categories as links', async () => {
    show();
    await screen.findAllByRole('heading', { level: 3 });
    const nav = screen.getByRole('navigation', { name: 'Category' });
    expect(nav).toHaveTextContent('All');
    expect(screen.getByRole('link', { name: 'Lawyers' })).toHaveAttribute('href', '/directory?category=lawyer');
    expect(screen.getByRole('link', { name: 'Consultants' })).toHaveAttribute('href', '/directory?category=consultant');
    expect(screen.getByRole('link', { name: 'Organisations' })).toHaveAttribute('href', '/directory?category=organisation');
  });

  it('puts the category links in a two-column grid on a phone', async () => {
    show();
    await screen.findAllByRole('heading', { level: 3 });
    const list = screen.getByRole('navigation', { name: 'Category' }).querySelector('ul');
    expect(list).toHaveClass('grid', 'grid-cols-2', 'sm:flex');
    screen.getAllByRole('link', { name: /^(All|Lawyers|Consultants|Organisations)$/ })
      .forEach((link) => expect(link).toHaveClass('w-full', 'sm:w-auto'));
  });

  it('asks the server for one category and marks it as current', async () => {
    show('/directory?category=consultant');
    await screen.findAllByRole('heading', { level: 3 });
    expect(lastUrl()).toMatch(/\/directory\/providers\?category=consultant$/);
    expect(screen.getByRole('link', { name: 'Consultants' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'All' })).not.toHaveAttribute('aria-current');
  });

  it('ignores a category it does not know', async () => {
    show('/directory?category=%27%3B%20DROP');
    await screen.findAllByRole('heading', { level: 3 });
    expect(lastUrl()).toMatch(/\/directory\/providers$/);
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
  });

  it('links to the booking check', async () => {
    show();
    await screen.findAllByRole('heading', { level: 3 });
    expect(screen.getByRole('link', { name: /Check with your code/ })).toHaveAttribute('href', '/directory/booking-check');
  });

  it('searches providers with the words typed and keeps the category', async () => {
    const user = userEvent.setup({ delay: null });
    show('/directory?category=lawyer');
    await screen.findAllByRole('heading', { level: 3 });
    await user.type(screen.getByLabelText('Search providers'), 'kigali');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastUrl()).toMatch(/\/directory\/providers\?category=lawyer&q=kigali$/));
  });

  it('clears the search and goes back to the whole list', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findAllByRole('heading', { level: 3 });
    await user.type(screen.getByLabelText('Search providers'), 'kigali');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: 'Clear the search' }));
    await waitFor(() => expect(lastUrl()).toMatch(/\/directory\/providers$/));
    expect(screen.queryByRole('button', { name: 'Clear the search' })).not.toBeInTheDocument();
  });

  it('says in words which providers take bookings and which are contact-direct', async () => {
    show();
    await screen.findAllByRole('heading', { level: 3 });
    expect(screen.getAllByText('Bookings open')).toHaveLength(1);
    expect(screen.getAllByText('Contact directly')).toHaveLength(1);
  });

  it('has one announcement region from the start and says how many providers are listed', async () => {
    show();
    const region = screen.getAllByRole('status')[0];
    expect(region).toBeInTheDocument();
    await waitFor(() => expect(region).toHaveTextContent('2 providers listed'));
  });

  it('announces that nobody matches a search, not only shows it', async () => {
    global.fetch.mockResolvedValue(reply(200, []));
    show('/directory?category=lawyer');
    const region = screen.getAllByRole('status')[0];
    await waitFor(() => expect(region).toHaveTextContent('No providers found'));
  });

  it('explains that a request is not a confirmed appointment', async () => {
    show();
    await screen.findAllByRole('heading', { level: 3 });
    expect(screen.getByText(/not a confirmed appointment/)).toBeInTheDocument();
  });

  it('has no demonstration labels', async () => {
    show();
    await screen.findAllByRole('heading', { level: 3 });
    expect(document.body.textContent).not.toMatch(/Demonstration|Not a live recommendation|Not provided/);
  });

  it('never leaves the reader stranded when the list is empty', async () => {
    global.fetch.mockResolvedValue(reply(200, []));
    show();
    expect(await screen.findByText('You can still get help')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask a legal expert' })).toHaveAttribute('href', '/ask');
    expect(screen.getByRole('link', { name: /in danger right now/ })).toHaveAttribute('href', '/emergency');
  });

  it('shows the error and the other ways forward when the request fails', async () => {
    global.fetch.mockResolvedValue(reply(500, { error: 'The server is busy.' }));
    show();
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
    expect(screen.getByText('You can still get help')).toBeInTheDocument();
  });
describe('Directory on a wide screen: the comparison table', () => {
  const WIDE = [
    { id: 1, name: 'Example Pro Bono Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', location: 'Kigali', services: 'Free advice on rent.', languages: 'English, Kinyarwanda', is_free: true, bookable: true },
    { id: 2, name: 'Example Legal Aid Office', category: 'organisation', type: 'maj_office', location: null, services: null, languages: null, is_free: false, bookable: false },
  ];
  const original = window.matchMedia;
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(reply(200, WIDE));
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => { window.matchMedia = original; });

  it('shows a table with one named column for each thing to compare', async () => {
    show();
    const table = await screen.findByRole('table', { name: /compared by services, location, languages and cost/i });
    const heads = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(['Provider', 'Services', 'Location', 'Languages', 'Cost', 'Action']);
  });

  it('draws the list once: a table and no cards', async () => {
    show();
    await screen.findByRole('table');
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
  });

  it('puts the name, its words, and the real values in the row', async () => {
    show();
    const row = (await screen.findByRole('link', { name: 'Example Pro Bono Lawyer' })).closest('tr');
    expect(screen.getByRole('link', { name: 'Example Pro Bono Lawyer' })).toHaveAttribute('href', '/directory/1');
    expect(within(row).getByText('Pro-bono lawyer')).toBeInTheDocument();
    expect(within(row).getByText('Free advice on rent.')).toBeInTheDocument();
    expect(within(row).getByText('Kigali')).toBeInTheDocument();
    expect(within(row).getByText('English, Kinyarwanda')).toBeInTheDocument();
    expect(within(row).getByText('Free')).toBeInTheDocument();
  });

  it('says in words when a value was not recorded and never leaves a cell empty', async () => {
    show();
    const row = (await screen.findByRole('link', { name: 'Example Legal Aid Office' })).closest('tr');
    expect(within(row).getAllByText('Not recorded')).toHaveLength(3);
    expect(within(row).getByText('May charge a fee. Ask first.')).toBeInTheDocument();
  });

  it('offers a booking where it can be asked for and an Expand listing button where not', async () => {
    show();
    const first = (await screen.findByRole('link', { name: 'Example Pro Bono Lawyer' })).closest('tr');
    expect(within(first).getByText('Bookings open')).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: 'Request consultation with Example Pro Bono Lawyer' })).toHaveAttribute('href', '/directory/book/1');
    const second = screen.getByRole('link', { name: 'Example Legal Aid Office' }).closest('tr');
    expect(within(second).getByText('Contact directly')).toBeInTheDocument();
    expect(within(second).getByRole('link', { name: 'Expand listing for Example Legal Aid Office' })).toHaveAttribute('href', '/directory/2');
    expect(within(second).queryByRole('link', { name: /Request consultation/ })).not.toBeInTheDocument();
  });

  it('keeps the signal that an entry is old, which the cards also show', async () => {
    global.fetch.mockResolvedValue(reply(200, [
      { ...WIDE[0], last_checked_at: '2026-09-01', stale: true },
      { ...WIDE[1], last_checked_at: null, stale: false },
    ]));
    show();
    const old = (await screen.findByRole('link', { name: 'Example Pro Bono Lawyer' })).closest('tr');
    expect(within(old).getByText('Details last checked 1 September 2026')).toBeInTheDocument();
    expect(within(old).getByText('Not re-checked for over six months. Confirm by phone first.')).toBeInTheDocument();
    const fresh = screen.getByRole('link', { name: 'Example Legal Aid Office' }).closest('tr');
    expect(within(fresh).queryByText(/Not re-checked/)).not.toBeInTheDocument();
    expect(within(fresh).queryByText(/Details last checked/)).not.toBeInTheDocument();
  });

  it('keeps the search, the category links and the empty state', async () => {
    global.fetch.mockResolvedValue(reply(200, []));
    show();
    expect(await screen.findByText('Nobody is listed here yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lawyers' })).toBeInTheDocument();
  });
});
});

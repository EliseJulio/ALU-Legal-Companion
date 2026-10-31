import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import WhereToGo from '@/pages/WhereToGo';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const ROUTES = [
  {
    id: 1, title: 'My landlord kept my deposit', first_forum_name: 'Example Abunzi Committee',
    deadline_days: 30, deadline_runs_from: 'the day you left',
    verified_at: '2026-09-02T09:00:00Z',
  },
  {
    id: 2, title: 'I was dismissed from work', first_forum_name: 'Example Labour Inspector',
    deadline_days: null, deadline_runs_from: null,
  },
];

const requested = () => global.fetch.mock.calls.map(([url]) => String(url));

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(reply(200, ROUTES));
});

const show = (path = '/where-to-go') => render(<MemoryRouter initialEntries={[path]}><WhereToGo /></MemoryRouter>);

describe('Where to go', () => {
  it('lists every matter with the office to go to first', async () => {
    show();
    const first = await screen.findByRole('link', { name: /Read route and next steps for My landlord kept my deposit/ });
    expect(first).toHaveAttribute('href', '/where-to-go/1');
    expect(screen.getByText('Go first to: Example Abunzi Committee')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Read route and next steps for I was dismissed from work/ })).toHaveAttribute('href', '/where-to-go/2');
  });

  it('gives every route link its own name so a screen reader can tell them apart', async () => {
    show();
    await screen.findByText('My landlord kept my deposit');
    const names = screen.getAllByRole('link', { name: /Read route and next steps/ }).map((a) => a.textContent);
    expect(new Set(names).size).toBe(names.length);
  });

  it('says in words when a matter has no recorded deadline', async () => {
    show();
    await screen.findByText('My landlord kept my deposit');
    expect(screen.getAllByText('No deadline has been recorded for this matter.')).toHaveLength(1);
  });

  it('names the number of matches for a screen reader', async () => {
    show();
    await screen.findByText('My landlord kept my deposit');
    expect(screen.getByText('2 matters found')).toBeInTheDocument();
  });

  it('keeps the search help beside the results with links to a legal expert and the directory', async () => {
    show();
    await screen.findByText('My landlord kept my deposit');
    expect(screen.getByRole('heading', { name: 'Search in your own words' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask a legal expert' })).toHaveAttribute('href', '/ask');
    expect(screen.getByRole('link', { name: 'Browse the Directory' })).toHaveAttribute('href', '/directory');
  });

  it('has no demonstration labels', async () => {
    show();
    await screen.findByText('My landlord kept my deposit');
    expect(document.body.textContent).not.toMatch(/Demonstration content|Illustrative issue|Not validated/);
  });

  it('offers All and the six areas of law as chips and marks All as chosen', async () => {
    show();
    await screen.findByText('My landlord kept my deposit');
    const group = within(screen.getByRole('group', { name: 'Filter by issue' }));
    expect(group.getAllByRole('button').map((b) => b.textContent)).toEqual(
      ['All', 'Renting', 'Work', 'Business', 'Immigration', 'Harassment', 'Cars and driving']);
    expect(group.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks the server for one area and keeps the words typed', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByText('My landlord kept my deposit');
    await user.click(screen.getByRole('button', { name: 'Renting' }));
    await waitFor(() => expect(requested().at(-1)).toMatch(/\/directory\/routes\?area=tenancy$/));
    expect(screen.getByRole('button', { name: 'Renting' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(screen.getByLabelText('Describe your issue'), 'deposit');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(requested().at(-1)).toMatch(/\/directory\/routes\?q=deposit&area=tenancy$/));
  });

  it('goes back to every area when All is chosen', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByText('My landlord kept my deposit');
    await user.click(screen.getByRole('button', { name: 'Work' }));
    await user.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => expect(requested().at(-1)).toMatch(/\/directory\/routes$/));
  });

  it('opens on the area named in the address', async () => {
    show('/where-to-go?area=employment');
    await screen.findByText('My landlord kept my deposit');
    expect(requested().at(-1)).toMatch(/\/directory\/routes\?area=employment$/);
    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ignores an area in the address that it does not know', async () => {
    show('/where-to-go?area=astronomy');
    await screen.findByText('My landlord kept my deposit');
    expect(requested().at(-1)).toMatch(/\/directory\/routes$/);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('puts the chosen area in the address and goes back to All when the address loses it', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter initialEntries={['/where-to-go?area=tenancy']}>
        <Link to="/where-to-go">plain link</Link>
        <WhereToGo />
      </MemoryRouter>,
    );
    await screen.findByText('My landlord kept my deposit');
    expect(screen.getByRole('button', { name: 'Renting' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('link', { name: 'plain link' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true'));
    expect(requested().at(-1)).toMatch(/\/directory\/routes$/);
  });

  it('words the heading and the empty answer for an area chosen without any search words', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByText('My landlord kept my deposit');
    await user.click(screen.getByRole('button', { name: 'Renting' }));
    expect(await screen.findByRole('heading', { name: 'Checked matters in Renting' })).toBeInTheDocument();
    global.fetch.mockResolvedValue(reply(200, []));
    await user.click(screen.getByRole('button', { name: 'Work' }));
    expect(await screen.findByText('Nothing in the directory matches that yet')).toBeInTheDocument();
    expect(screen.queryByText('No matters have been checked yet')).not.toBeInTheDocument();
  });

  it('clears the area as well as the words with Show every matter', async () => {
    const user = userEvent.setup({ delay: null });
    show('/where-to-go?area=tenancy');
    await screen.findByText('My landlord kept my deposit');
    await user.click(screen.getByRole('button', { name: 'Show every matter' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true'));
    expect(requested().at(-1)).toMatch(/\/directory\/routes$/);
  });

  it('announces that nothing was found from a region that was already on the page', async () => {
    global.fetch.mockResolvedValue(reply(200, []));
    show();
    const region = screen.getAllByRole('status')[0];
    await waitFor(() => expect(region).toHaveTextContent('No matters found'));
  });

  it('labels the chips with a visible "Filter by issue" and names the group by it', () => {
    show();
    const label = screen.getByText('Filter by issue');
    expect(label).toBeVisible();
    expect(screen.getByRole('group', { name: 'Filter by issue' })).toBeInTheDocument();
  });

  it('shows a cross on the chosen chip only and keeps its name plain', async () => {
    show('/where-to-go?area=tenancy');
    await screen.findByText('My landlord kept my deposit');
    const chosen = screen.getByRole('button', { name: 'Renting' });
    expect(chosen).toHaveTextContent('×');
    expect(chosen.querySelector('[aria-hidden="true"]')).toHaveTextContent('×');
    expect(screen.getByRole('button', { name: 'Work' })).not.toHaveTextContent('×');
    expect(screen.getByRole('button', { name: 'All' })).not.toHaveTextContent('×');
  });

  it('clears the area when the chosen chip is pressed again', async () => {
    const user = userEvent.setup({ delay: null });
    show('/where-to-go?area=tenancy');
    await screen.findByText('My landlord kept my deposit');
    await user.click(screen.getByRole('button', { name: 'Renting' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true'));
    expect(requested().at(-1)).toMatch(/\/directory\/routes$/);
  });

  it('shows no stamp or name of who checked a matter', async () => {
    show();
    await screen.findByText('My landlord kept my deposit');
    expect(screen.queryByText(/Checked by/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Test Expert/)).not.toBeInTheDocument();
  });

  it('shows the area on each card that has one and nothing on a card that has none', async () => {
    global.fetch.mockResolvedValue(reply(200, [{ ...ROUTES[0], area: 'tenancy' }, ROUTES[1]]));
    show();
    await screen.findByText('My landlord kept my deposit');
    const first = screen.getByRole('heading', { name: 'My landlord kept my deposit' }).closest('li');
    const second = screen.getByRole('heading', { name: 'I was dismissed from work' }).closest('li');
    expect(within(first).getByText('Renting')).toBeInTheDocument();
    expect(within(second).queryByText(/Renting|Work|Business|Immigration|Harassment|Cars and driving/)).toBeNull();
  });

  it('shows the time limit only when a matter has one', async () => {
    show();
    await screen.findByText('My landlord kept my deposit');
    expect(screen.getByText(/Time limit: 30 days from the day you left/)).toBeInTheDocument();
    expect(screen.getAllByText(/Time limit/)).toHaveLength(1);
  });

  it('searches with the words the reader typed', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByText('My landlord kept my deposit');
    await user.type(screen.getByLabelText('Describe your issue'), 'deposit back');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(requested().at(-1)).toMatch(/\/directory\/routes\?q=deposit%20back$/));
  });

  it('can go back to every matter after a search', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByText('My landlord kept my deposit');
    await user.type(screen.getByLabelText('Describe your issue'), 'deposit');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: 'Show every matter' }));
    await waitFor(() => expect(requested().at(-1)).toMatch(/\/directory\/routes$/));
    expect(screen.queryByRole('button', { name: 'Show every matter' })).not.toBeInTheDocument();
  });

  it('points to the directory and a legal expert when nothing matches', async () => {
    global.fetch.mockResolvedValue(reply(200, []));
    const user = userEvent.setup({ delay: null });
    show();
    await user.type(screen.getByLabelText('Describe your issue'), 'zzzz');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('Nothing in the directory matches that yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the directory' })).toHaveAttribute('href', '/directory');
    // The help beside the results offers the same way on, so there are two. Both lead to /ask.
    const ask = screen.getAllByRole('link', { name: 'Ask a legal expert' });
    expect(ask.length).toBeGreaterThan(0);
    ask.forEach((a) => expect(a).toHaveAttribute('href', '/ask'));
  });

  it('shows the error from the server', async () => {
    global.fetch.mockResolvedValue(reply(500, { error: 'The server is busy.' }));
    show();
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
  });
});

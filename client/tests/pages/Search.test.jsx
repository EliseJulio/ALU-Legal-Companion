import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import Search from '@/pages/Search';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const RESULTS = {
  guides: [{ id: 4, title: 'Getting your deposit back', summary: 'How to ask for it.', domain: 'tenancy', source_law: 'Law No. 00/0000' }],
  routes: [{ id: 3, title: 'My landlord kept my deposit', first_forum_name: 'Example Abunzi Committee' }],
  providers: [{ id: 9, name: 'Kigali Tenancy Clinic', type: 'legal_aid', location: 'Kigali', services: 'Advice on rent.' }],
};

const requested = () => global.fetch.mock.calls.map(([url]) => String(url));
const show = (path = '/search') => render(<MemoryRouter initialEntries={[path]}><Search /></MemoryRouter>);

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(reply(200, { query: 'deposit', results: RESULTS }));
});

describe('Search page', () => {
  it('has one h1, a labelled search box and asks nothing until there are words', () => {
    show();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByLabelText('Search guides, routes and providers')).toBeInTheDocument();
    expect(screen.getByLabelText('Where to search')).toHaveValue('all');
    expect(screen.getByText(/Type a word or two/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('offers All libraries and one choice for each library', () => {
    show();
    const options = within(screen.getByLabelText('Where to search')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['All libraries', 'Legal guides', 'Where to Go matters', 'Directory']);
  });

  it('asks the server for the words in the address and shows each library with links to its pages', async () => {
    show('/search?q=deposit');
    expect(await screen.findByRole('link', { name: 'Getting your deposit back' })).toHaveAttribute('href', '/guides/4');
    expect(requested().at(-1)).toMatch(/\/search\?q=deposit&library=all$/);
    expect(screen.getByRole('link', { name: 'My landlord kept my deposit' })).toHaveAttribute('href', '/where-to-go/3');
    expect(screen.getByRole('link', { name: 'Kigali Tenancy Clinic' })).toHaveAttribute('href', '/directory/9');
    expect(screen.getByRole('heading', { level: 2, name: 'Legal guides' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Where to Go matters' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Directory' })).toBeInTheDocument();
    expect(screen.getByText('How to ask for it.')).toBeInTheDocument();
    expect(screen.getByText(/Example Abunzi Committee/)).toBeInTheDocument();
  });

  it('says how many results were found from a region that is always on the page', async () => {
    show('/search?q=deposit');
    await screen.findByRole('link', { name: 'Getting your deposit back' });
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('3 results found for “deposit”');
  });

  it('says in words when a library has nothing and leaves the others', async () => {
    global.fetch.mockResolvedValue(reply(200, { query: 'deposit', results: { ...RESULTS, providers: [] } }));
    show('/search?q=deposit');
    await screen.findByRole('link', { name: 'Getting your deposit back' });
    const directory = screen.getByRole('heading', { level: 2, name: 'Directory' }).closest('section');
    expect(directory).toHaveTextContent('Nothing in the directory matches these words.');
  });

  it('says nothing was found anywhere and points to the next step', async () => {
    global.fetch.mockResolvedValue(reply(200, { query: 'zzzz', results: { guides: [], routes: [], providers: [] } }));
    show('/search?q=zzzz');
    expect(await screen.findByText(/Nothing matches “zzzz”/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask a legal expert' })).toHaveAttribute('href', '/ask');
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('No results found for “zzzz”');
  });

  it('asks for more than one character without calling the server', async () => {
    show('/search?q=a');
    // Once as visible text and once in the announcement region.
    expect(await screen.findAllByText(/at least 2 characters/)).toHaveLength(2);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('announces the short-words notice and the wait, not only the count', async () => {
    show('/search?q=a');
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Type at least 2 characters to search.');
  });

  it('keeps focus in the search box after a search', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    const box = screen.getByLabelText('Search guides, routes and providers');
    await user.type(box, 'deposit{Enter}');
    await screen.findByRole('link', { name: 'Getting your deposit back' });
    expect(box).toHaveFocus();
    expect(box).toHaveValue('deposit');
  });

  it('names the form so it differs from the search in the menu', () => {
    show();
    expect(screen.getByRole('search', { name: 'Search results' })).toBeInTheDocument();
  });

  it('takes focus on the heading when it is opened from the menu search', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/search', search: '?q=deposit', state: { focusResults: true } }]}>
        <Search />
      </MemoryRouter>,
    );
    await screen.findByRole('link', { name: 'Getting your deposit back' });
    expect(screen.getByRole('heading', { level: 1, name: 'Search' })).toHaveFocus();
  });

  it('takes no focus when it is opened any other way', async () => {
    show('/search?q=deposit');
    await screen.findByRole('link', { name: 'Getting your deposit back' });
    expect(screen.getByRole('heading', { level: 1, name: 'Search' })).not.toHaveFocus();
  });

  it('leaves the library out of the address when it is All libraries', async () => {
    function Where() {
      const l = useLocation();
      return <p data-testid="where">{l.pathname + l.search}</p>;
    }
    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter initialEntries={['/search']}><Search /><Where /></MemoryRouter>);
    await user.type(screen.getByLabelText('Search guides, routes and providers'), 'deposit{Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/search\?q=deposit$/);
  });

  it('does not add a step to the Back button when the same search is sent again', async () => {
    function Where() {
      const nav = useNavigationType();
      const l = useLocation();
      return <p data-testid="how">{`${nav} ${l.search}`}</p>;
    }
    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter initialEntries={['/search?q=deposit']}><Search /><Where /></MemoryRouter>);
    await screen.findByRole('link', { name: 'Getting your deposit back' });
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByTestId('how')).toHaveTextContent('REPLACE ?q=deposit');
  });

  it('searches one library when it is chosen and puts both choices in the address', async () => {
    const user = userEvent.setup({ delay: null });
    global.fetch.mockResolvedValue(reply(200, { query: 'deposit', results: { guides: RESULTS.guides } }));
    show();
    await user.type(screen.getByLabelText('Search guides, routes and providers'), 'deposit');
    await user.selectOptions(screen.getByLabelText('Where to search'), 'guides');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(requested().at(-1)).toMatch(/\/search\?q=deposit&library=guides$/));
    expect(await screen.findByRole('link', { name: 'Getting your deposit back' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Directory' })).not.toBeInTheDocument();
  });

  it('starts from the library named in the address', async () => {
    global.fetch.mockResolvedValue(reply(200, { query: 'deposit', results: { routes: RESULTS.routes } }));
    show('/search?q=deposit&library=routes');
    await screen.findByRole('link', { name: 'My landlord kept my deposit' });
    expect(screen.getByLabelText('Where to search')).toHaveValue('routes');
  });

  it('ignores a library it does not know', async () => {
    show('/search?q=deposit&library=astronomy');
    await screen.findByRole('link', { name: 'Getting your deposit back' });
    expect(screen.getByLabelText('Where to search')).toHaveValue('all');
    expect(requested().at(-1)).toMatch(/library=all$/);
  });

  it('shows the message from the server when the search fails', async () => {
    global.fetch.mockResolvedValue(reply(429, { error: 'Too many searches. Please wait a few minutes and try again.' }));
    show('/search?q=deposit');
    expect(await screen.findByText(/Too many searches/)).toBeInTheDocument();
  });

  it('carries no demonstration labels', async () => {
    show('/search?q=deposit');
    await screen.findByRole('link', { name: 'Getting your deposit back' });
    expect(document.body.textContent).not.toMatch(/Demonstration|Example record|Not provided/);
  });
});

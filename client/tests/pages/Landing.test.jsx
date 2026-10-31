import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '@/pages/Landing';
import { AuthProvider } from '@/lib/AuthContext';
import { clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const CONTACTS = [
  { name: 'Police', contact: '112', when: 'Immediate danger.' },
  { name: 'Corrected Hotline', contact: '+250 788 000 000', when: 'Any time.' },
  { name: 'Legal Aid Forum', contact: 'Nearest district office', when: 'Legal help.' },
];
const ROUTES = [
  { id: 3, title: 'My landlord kept my deposit', first_forum_name: 'Abunzi Committee', deadline_days: 30, deadline_runs_from: 'the day you left' },
  { id: 4, title: 'My employer did not pay me', first_forum_name: 'Labour Inspector', deadline_days: null, deadline_runs_from: null },
];
const ROUTE_DETAIL = {
  id: 3, title: 'My landlord kept my deposit', first_forum: { id: 9, name: 'Abunzi Committee' },
  legal_basis: 'A lease is a contract.', steps: ['Write to the landlord', 'Go to the committee', 'Ask for a written decision', 'A fourth step'],
  deadline_days: 30, deadline_runs_from: 'the day you left', verified_at: '2026-09-02T08:00:00.000Z',
};
const NO_CLOCK_DETAIL = { ...ROUTE_DETAIL, id: 4, title: 'My employer did not pay me', deadline_days: null, deadline_runs_from: null };
const guide = (id, domain, title) => ({
  id, domain, title, source_law: `Law No. ${id}/2018`, verified_at: '2026-09-03T09:00:00Z',
});
const GUIDES = [
  guide(1, 'tenancy', 'Getting your deposit back'),
  guide(2, 'employment', 'Your written contract'),
  guide(3, 'immigration', 'Staying on a student permit'),
  guide(4, 'harassment', 'Reporting harassment'),
  guide(5, 'business', 'A fifth guide that is not shown'),
];

// Each path gets its own reply. An unlisted path fails, as a server that is down would.
function serve(replies) {
  global.fetch = vi.fn((url) => {
    const path = String(url).replace(/^.*\/api/, '');
    return Promise.resolve(path in replies ? reply(200, replies[path]) : reply(500, { error: 'down' }));
  });
}

function show() {
  clearSession();
  return render(<MemoryRouter><AuthProvider><Landing /></AuthProvider></MemoryRouter>);
}

const region = (name) => screen.getByRole('region', { name });

beforeEach(() => {
  localStorage.clear();
});

describe('Landing page: the top', () => {
  it('leads with what the site is for and two ways in', () => {
    serve({});
    show();
    expect(screen.getByRole('heading', { level: 1, name: 'Understand your issue. Find your next step.' })).toBeInTheDocument();
    expect(screen.getByText('Legal information for ALU students & staff')).toBeInTheDocument();
    // Once in the top band and once in the closing call to action.
    const find = screen.getAllByRole('link', { name: 'Find Where to Go' });
    expect(find).toHaveLength(2);
    find.forEach((link) => expect(link).toHaveAttribute('href', '/where-to-go'));
    expect(screen.getByRole('link', { name: 'Explore Legal Guides' })).toHaveAttribute('href', '/guides');
    expect(screen.getByText('Browse without an account. Your personal matters stay private.')).toBeInTheDocument();
  });

  it('shows the three steps of a pathway and promises no outcome', () => {
    serve({});
    show();
    const card = screen.getByRole('complementary', { name: 'Clarity comes one step at a time.' });
    expect(card).toHaveTextContent('A pathway, not a promise');
    for (const step of ['Your issue', 'Reliable information', 'Appropriate assistance']) {
      expect(card).toHaveTextContent(step);
    }
    expect(within(card).getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('Landing page: the subjects', () => {
  it('offers the six subjects the guides cover, each one a link to the library on that subject', () => {
    serve({});
    show();
    const band = region('Everyday questions. A more informed start.');
    const expected = [
      ['Renting', 'tenancy'], ['Work', 'employment'], ['Business', 'business'],
      ['Immigration', 'immigration'], ['Harassment', 'harassment'], ['Cars and driving', 'vehicles'],
    ];
    for (const [label, value] of expected) {
      expect(within(band).getByRole('link', { name: `Explore ${label}` })).toHaveAttribute('href', `/guides?domain=${value}`);
    }
    expect(within(band).getAllByRole('link')).toHaveLength(6);
  });

  it('shows one card for each real subject and no other', () => {
    serve({});
    show();
    const band = region('Everyday questions. A more informed start.');
    const names = within(band).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Renting', 'Work', 'Business', 'Immigration', 'Harassment', 'Cars and driving']);
  });
});

describe('Landing page: the route', () => {
  it('shows one checked route in full', async () => {
    serve({ '/directory/routes': ROUTES, '/directory/routes/3': ROUTE_DETAIL });
    show();
    const band = await screen.findByRole('region', { name: 'Not sure which office to approach?' });
    await within(band).findByText('Go first to:', { exact: false });
    expect(within(band).getByRole('heading', { name: 'My landlord kept my deposit' })).toBeInTheDocument();
    expect(band).toHaveTextContent('Go first to: Abunzi Committee');
    expect(band).toHaveTextContent('Time limit: ');
    expect(band).toHaveTextContent('from the day you left');
    expect(band).toHaveTextContent('A lease is a contract.');
    // Three steps are shown. The fourth is left for the route page.
    expect(band).toHaveTextContent('Ask for a written decision');
    expect(band).not.toHaveTextContent('A fourth step');
  });

  it('links to the route in full and says a route is a starting point', async () => {
    serve({ '/directory/routes': ROUTES, '/directory/routes/3': ROUTE_DETAIL });
    show();
    const card = await screen.findByRole('complementary', { name: 'Read the route before you act' });
    expect(within(card).getByRole('link', { name: 'Read this route in full' })).toHaveAttribute('href', '/where-to-go/3');
    expect(card).toHaveTextContent('It does not promise an outcome.');
  });

  it('says there is no confirmed deadline when the route has none', async () => {
    serve({ '/directory/routes': [ROUTES[1]], '/directory/routes/4': NO_CLOCK_DETAIL });
    show();
    const band = await screen.findByRole('region', { name: 'Not sure which office to approach?' });
    await within(band).findByText('No deadline recorded');
    expect(band).not.toHaveTextContent('Time limit');
  });

  it('says why it is empty when nothing is verified yet and points to the directory', async () => {
    serve({ '/directory/routes': [] });
    show();
    const band = await screen.findByRole('region', { name: 'Not sure which office to approach?' });
    expect(band).toHaveTextContent('No matter has been verified yet.');
    expect(within(band).getByRole('link', { name: 'See the directory' })).toHaveAttribute('href', '/directory');
    expect(screen.queryByRole('complementary', { name: 'Read the route before you act' })).not.toBeInTheDocument();
  });
});

describe('Landing page: search', () => {
  it('offers a card that leads to the search page for screens where the menu is closed', () => {
    serve({});
    show();
    const card = screen.getByRole('region', { name: 'Search guides or routes' });
    expect(within(card).getByText(/Choose a library, then search/)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Choose where to search' })).toHaveAttribute('href', '/search');
    // The wide screen has the search box in the menu, so the card is for smaller screens.
    expect(card).toHaveClass('xl:hidden');
  });
});

describe('Landing page: the guides', () => {
  it('shows up to four checked guides with the law they rest on', async () => {
    serve({ '/guides': GUIDES });
    show();
    const band = region('Read for your situation, not a law number.');
    const first = await within(band).findByRole('link', { name: 'Getting your deposit back' });
    expect(first).toHaveAttribute('href', '/guides/1');
    expect(band).toHaveTextContent('Law No. 1/2018');
    expect(band).toHaveTextContent('Renting');
    expect(within(band).queryByRole('link', { name: 'A fifth guide that is not shown' })).not.toBeInTheDocument();
    expect(within(band).getAllByRole('listitem')).toHaveLength(4);
  });

  it('shows the summary of a guide that has one and nothing for a guide that has none', async () => {
    serve({ '/guides': [{ ...guide(1, 'tenancy', 'Getting your deposit back'), summary: 'How to get a deposit back.' }, guide(2, 'employment', 'Your written contract')] });
    show();
    const band = region('Read for your situation, not a law number.');
    await within(band).findByRole('link', { name: 'Getting your deposit back' });
    expect(within(band).getByText('How to get a deposit back.')).toBeInTheDocument();
    const second = within(band).getByRole('link', { name: 'Your written contract' }).closest('li');
    expect(second.querySelectorAll('p')).toHaveLength(2);
  });

  it('always links to the whole library', () => {
    serve({});
    show();
    expect(within(region('Read for your situation, not a law number.')).getByRole('link', { name: 'Explore all Legal Guides' }))
      .toHaveAttribute('href', '/guides');
  });

  it('shows no list when there are no guides', async () => {
    serve({ '/guides': [] });
    show();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(within(region('Read for your situation, not a law number.')).queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('Landing page: people, review and the close', () => {
  it('offers a consultation and a question to a legal expert', () => {
    serve({});
    show();
    const band = region('You don’t have to work it out alone.');
    expect(within(band).getByRole('link', { name: 'Find assistance in the Directory' })).toHaveAttribute('href', '/directory');
    expect(within(band).getByRole('link', { name: 'Ask a legal expert' })).toHaveAttribute('href', '/ask');
    expect(band).toHaveTextContent('The provider must accept before it becomes an appointment.');
  });

  it('says what review means in three plain statements', () => {
    serve({});
    show();
    const band = region('Trust is a visible record.');
    for (const title of ['Before publication', 'After a significant change', 'At the point of use']) {
      expect(within(band).getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(band).toHaveTextContent('An administrator reviews content against official sources before it is shown.');
  });

  it('ends with a call to action to find where to go', () => {
    serve({});
    show();
    const band = region('A good next step starts with a clearer question.');
    expect(within(band).getByRole('link', { name: 'Find Where to Go' })).toHaveAttribute('href', '/where-to-go');
  });
});

describe('Landing page: the urgent numbers', () => {
  it('shows the fixed urgent numbers when the contact list cannot be loaded', async () => {
    serve({});
    show();
    const band = region('In danger, or has someone hurt you?');
    expect(within(band).getByRole('link', { name: /3029/ })).toHaveAttribute('href', 'tel:3029');
    expect(within(band).getByRole('link', { name: /112/ })).toHaveAttribute('href', 'tel:112');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect(within(band).getByRole('link', { name: /3029/ })).toBeInTheDocument();
  });

  it('shows the numbers an administrator keeps and links only those a phone can dial', async () => {
    serve({ '/emergency-contacts': CONTACTS });
    show();
    const corrected = await screen.findByRole('link', { name: /Corrected Hotline/ });
    expect(corrected).toHaveAttribute('href', 'tel:+250788000000');
    expect(screen.getByRole('link', { name: /Police/ })).toHaveAttribute('href', 'tel:112');
    expect(screen.queryByText('Legal Aid Forum')).not.toBeInTheDocument();
    // The fixed number is gone once the real list has arrived.
    expect(screen.queryByRole('link', { name: /3029/ })).not.toBeInTheDocument();
  });

  it('is a labelled region with a button to every contact, and not an alert', () => {
    serve({});
    show();
    const band = region('In danger, or has someone hurt you?');
    expect(within(band).getByRole('link', { name: 'See all emergency contacts' })).toHaveAttribute('href', '/emergency');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Landing page: what it must never show', () => {
  it('says the matters could not be loaded, shows no raw error and keeps the rest', async () => {
    serve({});
    show();
    const band = await screen.findByRole('region', { name: 'Not sure which office to approach?' });
    expect(band).toHaveTextContent('We could not load the matters just now.');
    // Nothing says "nothing is verified" when the request simply failed.
    expect(band).not.toHaveTextContent('No matter has been verified yet.');
    expect(screen.queryByRole('complementary', { name: 'Read the route before you act' })).not.toBeInTheDocument();
    expect(screen.queryByText('down')).not.toBeInTheDocument();
    expect(region('In danger, or has someone hurt you?')).toBeInTheDocument();
    expect(region('Trust is a visible record.')).toBeInTheDocument();
    expect(region('You don’t have to work it out alone.')).toBeInTheDocument();
  });

  it('carries no demonstration labels and no figures from other countries or from the proposal', () => {
    serve({});
    show();
    expect(document.body.textContent).not.toMatch(/Demonstration|Illustrative|Example (topic|route|record)|not validated|for demonstration/i);
    expect(document.body.textContent).not.toMatch(/Ugandan|HiiL|World Justice Project|Webrwanda|84%/);
  });

  it('never mentions an assistant or AI', () => {
    serve({});
    show();
    expect(document.body.textContent).not.toMatch(/assistant|artificial|\bAI\b|chatbot/i);
  });

});

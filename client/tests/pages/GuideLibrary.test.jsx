import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import GuideLibrary from '@/pages/GuideLibrary';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const GUIDES = [
  { id: 1, domain: 'tenancy', title: 'Getting your deposit back', source_law: 'Law No. 00/0000', verified_at: '2026-09-02T09:00:00Z' },
  { id: 2, domain: 'employment', title: 'Your written contract', source_law: 'Order No. 00/00', verified_at: '2026-09-03T09:00:00Z' },
  { id: 3, domain: 'immigration', title: 'Staying on a student permit', source_law: 'Order No. 06/01', verified_at: '2026-09-04T09:00:00Z' },
];

// The address, so a test can read what the page wrote into it.
function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
const show = (path = '/guides') => render(<MemoryRouter initialEntries={[path]}><GuideLibrary /><Where /></MemoryRouter>);
const lastUrl = () => String(global.fetch.mock.calls.at(-1)[0]);
const original = window.matchMedia;
// wide stands for a screen of 768 px or more, where the topic buttons sit in a row.
const screenIs = (wide) => {
  window.matchMedia = vi.fn(() => ({ matches: wide, addEventListener() {}, removeEventListener() {} }));
};
const cards = () => screen.queryAllByRole('link', { name: /Getting your deposit back|Your written contract|Staying on a student permit/ });

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(reply(200, GUIDES));
});
afterEach(() => { window.matchMedia = original; });

describe('Guide library', () => {
  beforeEach(() => screenIs(true));

  it('lists every guide with its source law', async () => {
    show();
    const link = await screen.findByRole('link', { name: /Getting your deposit back/ });
    expect(link).toHaveAttribute('href', '/guides/1');
    // The title is the link. Its box is stretched over the card, so the rest is in the same item.
    expect(link.closest('li')).toHaveTextContent('Law No. 00/0000');
    expect(lastUrl()).toMatch(/\/guides$/);
  });

  it('searches with the words typed', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    await user.type(screen.getByLabelText('Search guides'), 'deposit');
    await waitFor(() => expect(lastUrl()).toMatch(/\/guides\?search=deposit$/));
  });

  it('offers All and the six topics as toggle buttons, with All chosen', async () => {
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    const group = within(screen.getByRole('group', { name: 'Filter by topic' }));
    expect(group.getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Renting', 'Work', 'Business', 'Immigration', 'Harassment', 'Cars and driving']);
    expect(group.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows only the guides of a chosen topic and asks the server for nothing more', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    await user.click(screen.getByRole('button', { name: 'Work' }));
    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('link', { name: /Getting your deposit back/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Your written contract/ })).toBeInTheDocument();
    expect(lastUrl()).toMatch(/\/guides$/);
  });

  it('lets several topics be chosen at once, shows a cross on each, and writes them in the address', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    await user.click(screen.getByRole('button', { name: 'Renting' }));
    await user.click(screen.getByRole('button', { name: 'Work' }));
    expect(screen.getByRole('link', { name: /Getting your deposit back/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Your written contract/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Staying on a student permit/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renting' })).toHaveTextContent('×');
    expect(screen.getByRole('button', { name: 'Immigration' })).not.toHaveTextContent('×');
    expect(screen.getByTestId('where')).toHaveTextContent('/guides?domain=tenancy%2Cemployment');
  });

  it('takes a topic off again when its button is pressed again, and All clears every topic', async () => {
    const user = userEvent.setup({ delay: null });
    show('/guides?domain=tenancy,employment');
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    await user.click(screen.getByRole('button', { name: 'Renting' }));
    expect(screen.queryByRole('link', { name: /Getting your deposit back/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(cards()).toHaveLength(3);
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/guides$/);
  });

  it('opens on the subject named in the link', async () => {
    show('/guides?domain=employment');
    await screen.findByRole('link', { name: /Your written contract/ });
    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('link', { name: /Getting your deposit back/ })).not.toBeInTheDocument();
  });

  it('opens on several subjects named in the link and ignores one it does not know', async () => {
    show('/guides?domain=tenancy,nonsense,immigration,tenancy');
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    expect(screen.getByRole('button', { name: 'Renting' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Immigration' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('link', { name: /Your written contract/ })).not.toBeInTheDocument();
  });

  it('ignores a subject it does not know', async () => {
    show('/guides?domain=nonsense');
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(cards()).toHaveLength(3);
  });

  it('says what is shown, in a region that is always on the page', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    const region = screen.getAllByRole('status')[0];
    await waitFor(() => expect(region).toHaveTextContent('3 guides listed'));
    await user.click(screen.getByRole('button', { name: 'Work' }));
    expect(region).toHaveTextContent('1 guide listed');
  });

  it('shows Read guide as a button-like cue and keeps it out of the link name', async () => {
    show();
    const link = await screen.findByRole('link', { name: /Getting your deposit back/ });
    const cue = [...link.closest('li').querySelectorAll('[aria-hidden="true"]')].find((el) => el.textContent.startsWith('Read guide'));
    expect(cue).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(link).toHaveAccessibleName('Getting your deposit back');
  });

  it('shows a ring round the whole card when its link has the keyboard', async () => {
    show();
    const link = await screen.findByRole('link', { name: /Getting your deposit back/ });
    expect(link.closest('li')).toHaveClass('has-[:focus-visible]:ring-2');
  });

  it('names the subject on each card and keeps the card as one link', async () => {
    show();
    const link = await screen.findByRole('link', { name: /Getting your deposit back/ });
    expect(link.closest('li')).toHaveTextContent('Renting');
    expect(link).toHaveAccessibleName('Getting your deposit back');
    expect(screen.getAllByRole('link', { name: /Your written contract/ })).toHaveLength(1);
  });

  it('offers the next steps below the list', async () => {
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    expect(screen.getByRole('link', { name: 'Explore Where to Go' })).toHaveAttribute('href', '/where-to-go');
    expect(screen.getByRole('link', { name: 'Ask a legal expert' })).toHaveAttribute('href', '/ask');
  });

  it('shows the summary under the title when a guide has one and nothing when it has none', async () => {
    global.fetch.mockResolvedValue(reply(200, [{ ...GUIDES[0], summary: 'How to get a deposit back.' }, GUIDES[1]]));
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    expect(screen.getByText('How to get a deposit back.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Your written contract/ }).closest('li')).not.toHaveTextContent('How to get');
  });

  it('points to a legal expert when the library is empty', async () => {
    global.fetch.mockResolvedValue(reply(200, []));
    show();
    expect(await screen.findByText('No guides match that yet.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ask a legal expert' }).length).toBeGreaterThan(0);
  });

  it('says so and offers to show every guide when the chosen topics hold none', async () => {
    const user = userEvent.setup({ delay: null });
    show('/guides?domain=harassment');
    expect(await screen.findByText('No guides match that yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show every guide' }));
    expect(await screen.findByRole('link', { name: /Getting your deposit back/ })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/guides$/);
  });

  it('shows the server message when the list cannot be loaded', async () => {
    global.fetch.mockResolvedValue(reply(500, { error: 'The server is busy.' }));
    show();
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
  });
});

describe('Guide library on a phone: the Filter guides panel', () => {
  beforeEach(() => screenIs(false));
  const trigger = () => screen.getByRole('button', { name: /^Filter guides/ });
  const panel = () => screen.getByRole('region', { name: 'Filter guides' });

  it('has a Filter guides button and no row of topic buttons', async () => {
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Filter by topic' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Filter guides' })).not.toBeInTheDocument();
  });

  it('opens a panel with a checkbox for each topic and the three actions, and focuses the first box', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    await user.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    const p = within(panel());
    expect(p.getAllByRole('checkbox').map((c) => c.closest('label').textContent)).toEqual(['Renting', 'Work', 'Business', 'Immigration', 'Harassment', 'Cars and driving']);
    expect(p.getByRole('button', { name: 'Apply filters' })).toBeInTheDocument();
    expect(p.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(p.getByRole('button', { name: 'Close filters' })).toBeInTheDocument();
    expect(p.getByRole('checkbox', { name: 'Renting' })).toHaveFocus();
  });

  it('changes nothing until Apply is pressed, then filters, closes and puts focus back on the button', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    await user.click(trigger());
    await user.click(within(panel()).getByRole('checkbox', { name: 'Work' }));
    await user.click(within(panel()).getByRole('checkbox', { name: 'Immigration' }));
    expect(cards()).toHaveLength(3);
    await user.click(within(panel()).getByRole('button', { name: 'Apply filters' }));
    expect(screen.queryByRole('region', { name: 'Filter guides' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Getting your deposit back/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Your written contract/ })).toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveTextContent('Filter guides (2)');
    expect(screen.getByTestId('where')).toHaveTextContent('/guides?domain=employment%2Cimmigration');
  });

  it('keeps the chosen filters visible after closing, each one removable', async () => {
    const user = userEvent.setup({ delay: null });
    show('/guides?domain=employment,immigration');
    await screen.findByRole('link', { name: /Your written contract/ });
    const applied = within(screen.getByRole('group', { name: 'Applied filters' }));
    expect(applied.getAllByRole('button').map((b) => b.textContent.replace(/\s/g, ' ').trim())).toEqual(['Work ×', 'Immigration ×']);
    await user.click(applied.getByRole('button', { name: 'Remove filter: Work' }));
    expect(screen.queryByRole('link', { name: /Your written contract/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Staying on a student permit/ })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/guides?domain=immigration');
  });

  it('names an applied filter by what pressing it does, and does not call it a toggle', async () => {
    show('/guides?domain=employment');
    await screen.findByRole('link', { name: /Your written contract/ });
    const chip = within(screen.getByRole('group', { name: 'Applied filters' })).getByRole('button');
    expect(chip).toHaveAccessibleName('Remove filter: Work');
    expect(chip).not.toHaveAttribute('aria-pressed');
  });

  it('puts focus on the Filter guides button when an applied filter is removed', async () => {
    const user = userEvent.setup({ delay: null });
    show('/guides?domain=employment');
    await screen.findByRole('link', { name: /Your written contract/ });
    await user.click(screen.getByRole('button', { name: 'Remove filter: Work' }));
    expect(trigger()).toHaveFocus();
  });

  it('hides the applied filters while the panel is open so they cannot disagree with it', async () => {
    const user = userEvent.setup({ delay: null });
    show('/guides?domain=employment');
    await screen.findByRole('link', { name: /Your written contract/ });
    await user.click(trigger());
    expect(screen.queryByRole('group', { name: 'Applied filters' })).not.toBeInTheDocument();
  });

  it('names the filters in the announcement, so a change of filter is always announced', async () => {
    show('/guides?domain=employment,immigration');
    const region = screen.getAllByRole('status')[0];
    await waitFor(() => expect(region).toHaveTextContent('2 guides listed, filtered by Work, Immigration'));
  });

  it('points aria-controls at the panel only while the panel exists', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    expect(trigger()).not.toHaveAttribute('aria-controls');
    await user.click(trigger());
    expect(trigger()).toHaveAttribute('aria-controls', 'filter-panel');
  });

  it('puts focus in the search box when Show every guide removes itself', async () => {
    const user = userEvent.setup({ delay: null });
    show('/guides?domain=harassment');
    await user.click(await screen.findByRole('button', { name: 'Show every guide' }));
    expect(screen.getByLabelText('Search guides')).toHaveFocus();
  });

  it('closes the panel when the window grows wide and does not reopen it when it narrows again', async () => {
    const user = userEvent.setup({ delay: null });
    const listeners = new Set();
    let matches = false;
    window.matchMedia = vi.fn(() => ({
      get matches() { return matches; },
      addEventListener: (_, fn) => listeners.add(fn),
      removeEventListener: (_, fn) => listeners.delete(fn),
    }));
    const resize = (wide) => act(() => { matches = wide; listeners.forEach((fn) => fn()); });
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    await user.click(trigger());
    expect(screen.getByRole('region', { name: 'Filter guides' })).toBeInTheDocument();
    resize(true);
    expect(screen.queryByRole('region', { name: 'Filter guides' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter by topic' })).toBeInTheDocument();
    resize(false);
    expect(screen.queryByRole('region', { name: 'Filter guides' })).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows no applied filters group when nothing is chosen', async () => {
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    expect(screen.queryByRole('group', { name: 'Applied filters' })).not.toBeInTheDocument();
  });

  it('clears every filter, closes, and puts focus back on the button', async () => {
    const user = userEvent.setup({ delay: null });
    show('/guides?domain=employment');
    await screen.findByRole('link', { name: /Your written contract/ });
    await user.click(trigger());
    expect(within(panel()).getByRole('checkbox', { name: 'Work' })).toBeChecked();
    await user.click(within(panel()).getByRole('button', { name: 'Clear filters' }));
    expect(screen.queryByRole('region', { name: 'Filter guides' })).not.toBeInTheDocument();
    expect(cards()).toHaveLength(3);
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveTextContent(/^Filter guides$/);
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/guides$/);
  });

  it('closes without applying and forgets what was ticked', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    await user.click(trigger());
    await user.click(within(panel()).getByRole('checkbox', { name: 'Work' }));
    await user.click(within(panel()).getByRole('button', { name: 'Close filters' }));
    expect(screen.queryByRole('region', { name: 'Filter guides' })).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(cards()).toHaveLength(3);
    await user.click(trigger());
    expect(within(panel()).getByRole('checkbox', { name: 'Work' })).not.toBeChecked();
  });

  it('closes with Escape and puts focus back on the button', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Filter guides' })).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('starts the panel from the filters already applied', async () => {
    const user = userEvent.setup({ delay: null });
    show('/guides?domain=tenancy');
    await screen.findByRole('link', { name: /Getting your deposit back/ });
    await user.click(trigger());
    expect(within(panel()).getByRole('checkbox', { name: 'Renting' })).toBeChecked();
    expect(within(panel()).getByRole('checkbox', { name: 'Work' })).not.toBeChecked();
  });
});

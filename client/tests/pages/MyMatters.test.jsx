import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MyMatters from '@/pages/MyMatters';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';
import { todayIso } from '@/lib/dates';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

// A date some days from today, written the way the server sends dates.
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return todayIso(d);
};

function show(role = 'student') {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'a@example.org', role } });
  return render(<MemoryRouter><AuthProvider><MyMatters /></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(reply(200, []));
});

describe('My matters', () => {
  it('says so when there is nothing yet and offers two ways to start', async () => {
    show();
    expect(await screen.findByText('You are not tracking anything yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start from where to go' })).toHaveAttribute('href', '/where-to-go');
    expect(screen.getByRole('link', { name: 'New matter' })).toHaveAttribute('href', '/matters/new');
  });

  it('lists each matter with its next step, deadline and who it is shared with', async () => {
    global.fetch.mockResolvedValue(reply(200, [{
      id: 5, title: 'Deposit from my old flat', status: 'open', next_action: 'Write to the landlord',
      next_due: inDays(30), shared_with_name: 'Example Pro Bono Lawyer',
    }]));
    show();
    const link = await screen.findByRole('link', { name: /Deposit from my old flat/ });
    expect(link).toHaveAttribute('href', '/matters/5');
    expect(link).toHaveTextContent('Next: Write to the landlord');
    expect(link).toHaveTextContent('Shared with Example Pro Bono Lawyer');
    expect(link).toHaveTextContent('in 30 days');
    expect(link).toHaveTextContent('Open');
  });

  it('stresses a deadline within a week and not a later one', async () => {
    global.fetch.mockResolvedValue(reply(200, [
      { id: 1, title: 'Soon', status: 'open', next_due: inDays(3) },
      { id: 2, title: 'Later', status: 'open', next_due: inDays(40) },
    ]));
    show();
    await screen.findByRole('link', { name: /Soon/ });
    expect(screen.getByText(/in 3 days/).className).toMatch(/text-warning-strong/);
    expect(screen.getByText(/in 40 days/).className).not.toMatch(/text-warning-strong/);
  });

  it('does not stress the deadline of a finished matter', async () => {
    global.fetch.mockResolvedValue(reply(200, [{ id: 1, title: 'Done', status: 'closed', next_due: inDays(2) }]));
    show();
    await userEvent.setup({ delay: null }).click(await screen.findByRole('button', { name: /^Finished/ }));
    await screen.findByRole('link', { name: /Done/ });
    expect(screen.getByText(/in 2 days/).className).not.toMatch(/text-warning-strong/);
    expect(screen.getByText('Finished')).toBeInTheDocument();
  });

  it('shows the server message when the list cannot be loaded', async () => {
    global.fetch.mockResolvedValue(reply(500, { error: 'The server is busy.' }));
    show();
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
  });

  it('sends a visitor to sign in without asking the server', () => {
    show(null);
    expect(screen.getByText('Sign in to track a matter')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not ask the server for matters on behalf of an expert', () => {
    show('legal_expert');
    expect(screen.getByText('Matter tracking is for students and staff')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("My matters: what the page promises", () => {
  it("says a matter is private by default and ends the breadcrumb here", async () => {
    show();
    await screen.findByText("You are not tracking anything yet.");
    expect(screen.getByText("Private by default")).toBeInTheDocument();
    expect(screen.getByText(/A public route never exposes your case details/)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Home / My Matters");
  });

  it("has no demonstration labels", async () => {
    show();
    await screen.findByText("You are not tracking anything yet.");
    expect(document.body.textContent).not.toMatch(/Demo:|example records|Sample date/i);
  });
});

const MATTERS = [
  { id: 1, title: 'Rental deposit', status: 'open', next_action: 'Prepare questions', next_due: null, shared_with_name: null },
  { id: 2, title: 'Workplace question', status: 'open', next_action: 'Review my summary', next_due: inDays(20), shared_with_name: 'Example Legal Expert' },
  { id: 3, title: 'Old dispute', status: 'closed', next_action: null, next_due: null, shared_with_name: null },
];

describe('My matters: Open and Finished', () => {
  beforeEach(() => { global.fetch = vi.fn().mockResolvedValue(reply(200, MATTERS)); });

  it('shows the open matters first and the finished ones when asked', async () => {
    show();
    const u = userEvent.setup({ delay: null });
    await screen.findByRole('link', { name: /Rental deposit/ });
    expect(screen.queryByRole('link', { name: /Old dispute/ })).toBeNull();
    const open = screen.getByRole('button', { name: /^Open/ });
    expect(open).toHaveAttribute('aria-pressed', 'true');
    await u.click(screen.getByRole('button', { name: /^Finished/ }));
    expect(screen.getByRole('link', { name: /Old dispute/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Rental deposit/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Finished/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says which group is empty and not that nothing is tracked', async () => {
    global.fetch.mockResolvedValue(reply(200, [MATTERS[2]]));
    show();
    expect(await screen.findByText('You have no open matters.')).toBeInTheDocument();
    expect(screen.queryByText('You are not tracking anything yet.')).toBeNull();
  });

  it('says the order: matters without a deadline come last', async () => {
    show();
    expect(await screen.findByText('Matters without a deadline appear last.')).toBeInTheDocument();
  });

  it('marks each matter Private or Shared in words', async () => {
    show();
    await screen.findByRole('link', { name: /Rental deposit/ });
    expect(screen.getByRole('link', { name: /Rental deposit/ })).toHaveTextContent('Private');
    expect(screen.getByRole('link', { name: /Workplace question/ })).toHaveTextContent('Shared with Example Legal Expert');
    expect(screen.getByRole('link', { name: /Rental deposit/ })).toHaveTextContent('No deadline recorded');
  });
});

describe('My matters: the table on a wide screen', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(reply(200, MATTERS));
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => { window.matchMedia = original; });

  it('is one table with a row for each open matter and one Open link in each row', async () => {
    show();
    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Matter', 'Next step', 'Deadline', 'Sharing', 'Open']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    const link = within(table).getByRole('link', { name: 'Open Rental deposit' });
    expect(link).toHaveAttribute('href', '/matters/1');
    expect(within(table).getByText('Private · Not shared')).toBeInTheDocument();
    expect(within(table).getByText('Shared with Example Legal Expert')).toBeInTheDocument();
    expect(within(table).getAllByRole('link')).toHaveLength(2);
  });
});

describe('My matters: announcing the change of list', () => {
  it('says how many matters the chosen group shows', async () => {
    global.fetch = vi.fn().mockResolvedValue(reply(200, MATTERS));
    show();
    await screen.findByRole('link', { name: /Rental deposit/ });
    expect(screen.getByText('Showing 2 open matters')).toBeInTheDocument();
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: /^Finished/ }));
    expect(screen.getByText('Showing 1 finished matter')).toBeInTheDocument();
  });
});

describe('My matters: sorting', () => {
  const TWO = [
    { id: 1, title: 'Zebra dispute', status: 'open', next_action: null, next_due: '2099-01-02', shared_with_name: null },
    { id: 2, title: 'Apple lease', status: 'open', next_action: null, next_due: '2099-03-02', shared_with_name: null },
  ];
  beforeEach(() => { global.fetch = vi.fn().mockResolvedValue(reply(200, TWO)); });
  const order = () => screen.getAllByRole('link', { name: /Zebra|Apple/ }).map((a) => (/Zebra/.test(a.textContent) ? 'Zebra' : 'Apple'));

  it('keeps the server order by deadline and can list the matters by name', async () => {
    show();
    const u = userEvent.setup({ delay: null });
    await screen.findByRole('link', { name: /Zebra/ });
    expect(order()).toEqual(['Zebra', 'Apple']);
    expect(screen.getByText('Matters without a deadline appear last.')).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Sort by'), 'name');
    expect(order()).toEqual(['Apple', 'Zebra']);
    expect(screen.getByText('Listed by name.')).toBeInTheDocument();
  });
});

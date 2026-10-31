import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NewMatter from '@/pages/NewMatter';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const ROUTE = {
  id: 4,
  title: 'My landlord kept my deposit',
  steps: ['Write to the landlord', 'Go to the committee'],
  deadline_days: 30,
  deadline_runs_from: 'the day you left',
  first_forum: { name: 'Example Abunzi Committee' },
};

function show(search = '') {
  clearSession();
  saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'a@example.org', role: 'student' } });
  return render(
    <MemoryRouter initialEntries={[`/matters/new${search}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/matters/new" element={<NewMatter />} />
          <Route path="/matters/:id" element={<p>Matter page</p>} />
          <Route path="/matters" element={<p>List page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const postBody = () => {
  const call = global.fetch.mock.calls.find(([, options]) => options.method === 'POST');
  return JSON.parse(call[1].body);
};

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    if (options.method === 'POST') return reply(201, { id: 9 });
    return reply(200, ROUTE);
  });
});

describe('Track a blank matter', () => {
  it('sends what was typed and opens the new matter', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await user.type(screen.getByLabelText(/Private name/), '  Deposit from my old flat ');
    await user.type(screen.getByLabelText('Next step'), 'Write a letter');
    fireEvent.change(screen.getByLabelText('Known deadline (optional)'), { target: { value: '2099-01-10' } });
    await user.click(screen.getByRole('button', { name: 'Create private matter' }));
    expect(await screen.findByText('Matter page')).toBeInTheDocument();
    expect(postBody()).toEqual({ title: 'Deposit from my old flat', next_action: 'Write a letter', next_due: '2099-01-10' });
  });

  it('sends empty optional fields as null', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await user.type(screen.getByLabelText(/Private name/), 'Just a title');
    await user.click(screen.getByRole('button', { name: 'Create private matter' }));
    await screen.findByText('Matter page');
    expect(postBody()).toEqual({ title: 'Just a title', next_action: null, next_due: null });
  });

  it('shows the server message and keeps the form when it is refused', async () => {
    global.fetch.mockResolvedValue(reply(400, { error: 'Give the matter a short title' }));
    const user = userEvent.setup({ delay: null });
    show();
    await user.click(screen.getByRole('button', { name: 'Create private matter' }));
    expect(await screen.findByText('Give the matter a short title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create private matter' })).toBeEnabled();
  });

  it('has a way to cancel', () => {
    show();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/matters');
  });
});

describe('Track a matter from a route', () => {
  it('asks the server for the route and shows its first step', async () => {
    show('?route=4');
    expect(await screen.findByText(/First step: Example Abunzi Committee/)).toBeInTheDocument();
    expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/directory\/routes\/4$/);
    expect(screen.getByLabelText(/When was the day you left/)).toBeInTheDocument();
    expect(screen.getByText(/You have 30 days from that day/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Known deadline (optional)')).not.toBeInTheDocument();
  });

  it('sends only the start date and lets the server work out the deadline', async () => {
    show('?route=4');
    await screen.findByText(/First step/);
    fireEvent.change(screen.getByLabelText(/When was the day you left/), { target: { value: '2026-09-01' } });
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Create private matter' }));
    await screen.findByText('Matter page');
    expect(postBody()).toEqual({ route_id: 4, deadline_start: '2026-09-01' });
  });

  it('sends no start date when the box is empty', async () => {
    show('?route=4');
    await screen.findByText(/First step/);
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Create private matter' }));
    await screen.findByText('Matter page');
    expect(postBody()).toEqual({ route_id: 4 });
  });

  it('asks for no start date when the route has no deadline', async () => {
    global.fetch.mockImplementation(async () => reply(200, { ...ROUTE, deadline_days: null, deadline_runs_from: null }));
    show('?route=4');
    await screen.findByText(/First step/);
    expect(screen.queryByLabelText(/When was/)).not.toBeInTheDocument();
  });

  it('shows the server message when the route cannot be found', async () => {
    global.fetch.mockResolvedValue(reply(404, { error: 'That matter is not in the directory' }));
    show('?route=999');
    expect(await screen.findByText('That matter is not in the directory')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create private matter' })).not.toBeInTheDocument();
  });
});

describe("Track a matter: what the page promises", () => {
  it("says the record is private and gives a way back through the breadcrumb", () => {
    show();
    expect(screen.getByText("Private by default")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Home / My Matters / New matter");
    expect(screen.getByRole("link", { name: "My Matters" })).toHaveAttribute("href", "/matters");
  });
});

describe('New matter: the page as designed', () => {
  it('is called New matter and has a way back to the list', () => {
    show();
    expect(screen.getByRole('heading', { level: 1, name: 'New matter' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to My Matters/ })).toHaveAttribute('href', '/matters');
  });

  it('tells the reader what a private name should and should not hold', () => {
    show();
    expect(screen.getByLabelText(/Private name/)).toHaveAccessibleDescription(/Avoid unnecessary identifying details/);
  });

  it('points to Where to Go for a worked-out deadline when there is no route', () => {
    show();
    expect(screen.getByRole('link', { name: 'Start from Where to Go' })).toHaveAttribute('href', '/where-to-go');
    expect(screen.getByLabelText('Known deadline (optional)')).toHaveAccessibleDescription(/Leave this blank if no date has been confirmed/);
  });

  it('does not point to Where to Go when the matter already comes from a route', async () => {
    show('?route=4');
    await screen.findByText(/First step/);
    expect(screen.queryByRole('link', { name: 'Start from Where to Go' })).not.toBeInTheDocument();
  });
});

describe('New matter: what is required', () => {
  it('says the private name is required when there is no route, and optional when there is one', async () => {
    const { unmount } = show();
    expect(screen.getByLabelText(/Private name/)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('(required)')).toBeInTheDocument();
    unmount();
    show('?route=4');
    await screen.findByText(/First step/);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
    expect(screen.getByLabelText(/Private name/)).not.toHaveAttribute('aria-required');
  });
});

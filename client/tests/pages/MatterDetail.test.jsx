import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MatterDetail from '@/pages/MatterDetail';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const OWNER_MATTER = {
  id: 7,
  title: 'Deposit from my old flat',
  status: 'open',
  next_action: 'Write to the landlord',
  next_due: '2099-01-10',
  route_id: 4,
  shared_with: null,
  shared_with_name: null,
  viewer: 'owner',
  events: [
    { id: 1, occurred_on: '2026-09-02', description: 'Sent a letter', author_is_owner: true, author_name: null },
    { id: 2, occurred_on: '2026-09-03', description: 'Please bring the lease', author_is_owner: false, author_name: 'Test Expert' },
  ],
  reminders: [
    { id: 1, send_on: '2099-01-03', status: 'pending' },
    { id: 2, send_on: '2099-01-09', status: 'missed' },
  ],
};

const copy = (value) => JSON.parse(JSON.stringify(value));
let matter;

// Answers by method and path. Anything not listed is an empty success.
function serve(overrides = {}) {
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    const key = `${options.method} ${path}`;
    if (overrides[key]) return overrides[key]();
    if (key === 'GET /matters/7') return reply(200, matter);
    if (key === 'GET /matters/share-targets') return reply(200, [{ id: 9, name: 'Example Pro Bono Lawyer' }]);
    if (options.method === 'DELETE' && path === '/matters/7') return { ok: true, status: 204, headers: { get: () => null } };
    return reply(200, {});
  });
}

const sent = (method, path) => global.fetch.mock.calls.filter(
  ([url, options]) => options.method === method && String(url).endsWith(path),
);

function show(role = 'student') {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: { id: 1, name: 'Test User', email: 'a@example.org', role } });
  return render(
    <MemoryRouter initialEntries={['/matters/7']}>
      <AuthProvider>
        <Routes>
          <Route path="/matters/:id" element={<MatterDetail />} />
          <Route path="/matters" element={<p>List page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  matter = copy(OWNER_MATTER);
  serve();
});

describe('Matter detail as the owner', () => {
  it('shows the title, status, next step, deadline and the way to the route', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Deposit from my old flat' })).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Write to the landlord')).toBeInTheDocument();
    expect(screen.getByText(/Deadline:.*\(in \d+ days\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Where this goes first/ })).toHaveAttribute('href', '/where-to-go/4');
    expect(screen.getByRole('link', { name: 'My Matters' })).toHaveAttribute('href', '/matters');
  });

  it("says reminders are a courtesy and not a guarantee", async () => {
    show();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("Reminders are a courtesy, not a guarantee")).toBeInTheDocument();
    expect(screen.getByText(/No reminders are scheduled without a known deadline/)).toBeInTheDocument();
  });

  it('lists the reminders in words and says they never name the matter', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    const list = within(screen.getByRole('region', { name: 'Reminders' }));
    expect(list.getByText(/Scheduled/)).toBeInTheDocument();
    expect(list.getByText(/Not sent in time/)).toBeInTheDocument();
    expect(list.getByText(/never what the matter is/)).toBeInTheDocument();
  });

  it('tells your own entries from the expert notes', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText(/· You$/)).toBeInTheDocument();
    expect(screen.getByText(/Note from Test Expert/)).toBeInTheDocument();
    expect(screen.getByText('Please bring the lease')).toBeInTheDocument();
  });

  it('shows the disclaimer', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Legal information not legal advice.')).toBeInTheDocument();
  });

  it('adds a line to the record only when something is written', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    const add = screen.getByRole('button', { name: 'Add to the record' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    await user.type(screen.getByLabelText('What happened'), '  Went to the office ');
    await user.click(add);
    const [[, options]] = sent('POST', '/matters/7/events');
    expect(JSON.parse(options.body)).toMatchObject({ description: 'Went to the office' });
    expect(JSON.parse(options.body).occurred_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('changes the next step and the deadline', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Change next step or deadline' }));
    const box = screen.getByLabelText('Next step');
    await user.clear(box);
    await user.type(box, 'Call the committee');
    await user.click(screen.getByRole('button', { name: 'Save next step' }));
    const [[, options]] = sent('PUT', '/matters/7');
    expect(JSON.parse(options.body)).toEqual({ next_action: 'Call the committee', next_due: '2099-01-10' });
  });

  it('marks the matter finished', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Mark as finished' }));
    const [[, options]] = sent('PUT', '/matters/7');
    expect(JSON.parse(options.body)).toEqual({ status: 'closed' });
  });

  it('shows Reopen and no way to add to the record once it is finished', async () => {
    matter.status = 'closed';
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Finished')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to the record' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change next step or deadline' })).not.toBeInTheDocument();
  });

  it('asks before it deletes and deletes nothing when the reader keeps it', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Delete matter…' }));
    expect(screen.getByText(/This permanently removes the matter and its record\. Expert access ends\. This cannot be undone\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep matter' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Keep matter' }));
    expect(sent('DELETE', '/matters/7')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Permanently delete matter' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete matter…' })).toHaveFocus();
  });

  it('deletes after confirmation and goes back to the list', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Delete matter…' }));
    await user.click(screen.getByRole('button', { name: 'Permanently delete matter' }));
    expect(await screen.findByText('List page')).toBeInTheDocument();
    expect(sent('DELETE', '/matters/7')).toHaveLength(1);
  });

  it('shares with the chosen lawyer', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    // The list of lawyers loads after the page does, so the test waits for it.
    const button = await screen.findByRole('button', { name: 'Share this matter' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.selectOptions(screen.getByLabelText('Share with'), '9');
    await user.click(button);
    const [[, options]] = sent('POST', '/matters/7/share');
    expect(JSON.parse(options.body)).toEqual({ provider_id: 9 });
  });

  it('says who it is shared with and stops sharing', async () => {
    matter.shared_with = 9;
    matter.shared_with_name = 'Example Pro Bono Lawyer';
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText(/cannot see your name or email/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revoke expert access' }));
    expect(sent('DELETE', '/matters/7/share')).toHaveLength(1);
  });

  it('says so when no lawyer takes shared matters', async () => {
    serve({ 'GET /matters/share-targets': async () => reply(200, []) });
    show();
    expect(await screen.findByText(/No lawyer on the platform is taking shared matters yet/)).toBeInTheDocument();
  });

  it('shows the server message when an action is refused', async () => {
    serve({ 'PUT /matters/7': async () => reply(400, { error: 'status must be open or closed' }) });
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Mark as finished' }));
    expect(await screen.findByText('status must be open or closed')).toBeInTheDocument();
  });
});

describe('Matter detail as a legal expert it is shared with', () => {
  beforeEach(() => {
    matter = { ...copy(OWNER_MATTER), viewer: 'expert', reminders: [] };
    delete matter.shared_with;
    serve();
  });

  it('shows the record and can add a note', async () => {
    show('legal_expert');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText(/The person who shared this/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to the record' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shared matters' })).toHaveAttribute('href', '/expert/matters');
  });

  it('has no reminders, no sharing and no way to change or delete the matter', async () => {
    show('legal_expert');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('region', { name: 'Reminders' })).not.toBeInTheDocument();
    expect(screen.queryByText('Share with one chosen expert')).not.toBeInTheDocument();
    for (const name of ['Change next step or deadline', 'Mark as finished', 'Delete matter…']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});

describe('Matter detail without access', () => {
  it('asks a visitor to sign in without asking the server', () => {
    show(null);
    expect(screen.getByText('Sign in to see this matter')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows the server message when the matter is not found', async () => {
    serve({ 'GET /matters/7': async () => reply(404, { error: 'Matter not found' }) });
    show();
    expect(await screen.findByText('Matter not found')).toBeInTheDocument();
  });
});

describe('Matter detail: the page as designed', () => {
  it('says what kind of matter it is, that it is private, and who can open it', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Open matter')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByText('Only you can access this private record.')).toBeInTheDocument();
  });

  it('says Shared and names the expert once the matter is shared', async () => {
    matter.shared_with = 9;
    matter.shared_with_name = 'Example Pro Bono Lawyer';
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Shared')).toBeInTheDocument();
    const access = within(screen.getByRole('heading', { name: 'Expert access' }).closest('section'));
    expect(access.getByText('Example Pro Bono Lawyer')).toBeInTheDocument();
    expect(access.getByText(/revoking access takes effect immediately/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share this matter' })).not.toBeInTheDocument();
  });

  it('says no expert has been chosen yet and sharing is never automatic', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('heading', { level: 2, name: 'Share with one chosen expert' })).toBeInTheDocument();
    expect(screen.getByText('Sharing is never automatic.')).toBeInTheDocument();
    expect(screen.getByText('No expert has been chosen yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke expert access' })).not.toBeInTheDocument();
  });

  it('keeps the edit form closed until asked and can close it again without saving', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByLabelText('Next step')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change next step or deadline' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Next step')).not.toBeInTheDocument();
    expect(sent('PUT', '/matters/7')).toHaveLength(0);
  });

  it('explains what finishing does and that it keeps the record private', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('heading', { level: 2, name: 'Finish this matter' })).toBeInTheDocument();
    expect(screen.getByText(/without changing its private status/)).toBeInTheDocument();
  });

  it('warns on the record form that free text can identify the person', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText(/Free text can identify you/)).toBeInTheDocument();
    expect(screen.getByLabelText('What happened')).toHaveAccessibleDescription(/Free text can identify you/);
  });

  it('has the sections in the order next step, record, documents', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names.indexOf('What comes next')).toBeLessThan(names.indexOf('What has happened'));
    expect(names.indexOf('What has happened')).toBeLessThan(names.indexOf('Add to your record'));
  });
});

describe('Matter detail: focus, refetch and who sees what', () => {
  it('keeps the page and the focus on the button that was pressed while the matter reloads', async () => {
    const user = userEvent.setup({ delay: null });
    // The second answer takes a moment, as a real network does. Without that the reload finishes
    // inside one render and a blanked page could never be seen.
    let gets = 0;
    serve({ 'GET /matters/7': async () => { gets += 1; if (gets > 1) await new Promise((r) => setTimeout(r, 60)); return reply(200, matter); } });
    show();
    const heading = await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Mark as finished' }));
    expect(await screen.findByText('Marked as finished.')).toBeInTheDocument();
    // Wait for the reload to start and to finish before looking at the page.
    await waitFor(() => expect(gets).toBe(2));
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    // The same heading element is still on the page. It was never replaced by "Loading…".
    expect(screen.getByRole('heading', { level: 1 })).toBe(heading);
    expect(screen.getByRole('button', { name: 'Mark as finished' })).toHaveFocus();
  });

  it('puts focus on the edit form when it opens and back on its button when it closes', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(document.body).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Change next step or deadline' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Edit next step' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Change next step or deadline' })).toHaveFocus();
  });

  it('does not move focus when the delete question is never opened', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('button', { name: 'Delete matter…' })).not.toHaveFocus();
  });

  it('shows an expert none of the owner-only parts, even when the matter has reminders', async () => {
    matter = { ...copy(OWNER_MATTER), viewer: 'expert' };
    delete matter.shared_with;
    serve();
    show('legal_expert');
    await screen.findByRole('heading', { level: 1 });
    expect(OWNER_MATTER.reminders.length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'Reminders' })).toBeNull();
    expect(screen.queryByText('Reminders are a courtesy, not a guarantee')).toBeNull();
    expect(screen.queryByText('Private')).toBeNull();
    expect(screen.queryByText('Shared')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Expert access' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Finish this matter' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Delete this matter?' })).toBeNull();
    expect(screen.getByText('Shared with you by its owner. You can read this record and add notes.')).toBeInTheDocument();
  });

  it('puts the documents after the record and the form to add to it', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    await screen.findByRole('heading', { level: 2, name: 'Documents' });
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names.indexOf('Documents')).toBeGreaterThan(names.indexOf('Add to your record'));
  });

  it('names the confirmation differently from the Delete card and ties it to its button', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Delete matter…' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Confirm deletion' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Delete this matter?' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Delete matter…' })).toHaveAttribute('aria-controls', 'confirm-delete');
    expect(document.getElementById('confirm-delete')).not.toBeNull();
  });

  it('sends only one delete when the button is pressed twice', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Delete matter…' }));
    const confirm = screen.getByRole('button', { name: 'Permanently delete matter' });
    await user.dblClick(confirm);
    expect(sent('DELETE', '/matters/7')).toHaveLength(1);
  });

  it('says tracking is for students and staff to a signed-in administrator, without asking the server', () => {
    show('admin');
    expect(screen.getByText('Matter tracking is for students and staff')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

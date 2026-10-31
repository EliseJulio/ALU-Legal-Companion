import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminChecklistEditor from '@/pages/AdminChecklistEditor';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const list = (over) => ({
  id: 3, slug: 'buying-a-car', title: 'Buying a car', description: 'What RRA asks for.', status: 'draft',
  review_comment: null, updated_at: '2026-10-20T00:00:00Z',
  items: [
    { key: 'sale-agreement', name: 'Sale agreement', notes: 'Signed by both.', where_to_get: 'A notary', required_if: 'always', source_url: 'https://www.rra.gov.rw/a', required: true },
    { key: 'ebm', name: 'EBM invoice', required: false },
  ],
  ...over,
});

let lists;
beforeEach(() => {
  lists = [list({})];
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/checklists/all') return reply(200, lists);
    if (options.method === 'PUT' && path === '/checklists/3') return reply(200, {});
    if (options.method === 'POST' && path === '/checklists') return reply(201, { id: 9 });
    return reply(404, { error: 'unexpected' });
  });
});

function show(path, { stubSaved = false } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/checklists/new" element={<AdminChecklistEditor />} />
        <Route path="/admin/checklists/:id" element={stubSaved ? <p>Edit page nine</p> : <AdminChecklistEditor />} />
        <Route path="/admin/checklists" element={<p>All checklists</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const sent = (method, suffix) => global.fetch.mock.calls.filter(([url, o]) => o.method === method && String(url).endsWith(suffix));
const u = () => userEvent.setup({ delay: null });

describe('Write a new checklist', () => {
  it('needs a title and a document before it can be saved, and says what is missing', async () => {
    show('/admin/checklists/new');
    expect(screen.getByRole('heading', { level: 1, name: 'Write a new checklist' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create this draft' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/Still needed before this can be saved: a title and at least one document/)).toBeInTheDocument();
  });

  it('makes the short name and the key for the system from what was typed', async () => {
    const user = u();
    show('/admin/checklists/new');
    await user.type(screen.getByLabelText('Title'), 'Buying a car');
    await user.click(screen.getByRole('button', { name: 'Add a document' }));
    await user.type(screen.getByLabelText('The document'), 'Yellow card');
    await user.click(screen.getByRole('button', { name: 'Create this draft' }));
    const body = JSON.parse(sent('POST', '/checklists')[0][1].body);
    expect(body).toEqual({ slug: 'buying-a-car', title: 'Buying a car', items: [{ key: 'yellow-card', name: 'Yellow card', required: true }] });
  });

  it('sends an unticked document as optional', async () => {
    const user = u();
    show('/admin/checklists/new');
    await user.type(screen.getByLabelText('Title'), 'Buying a car');
    await user.click(screen.getByRole('button', { name: 'Add a document' }));
    await user.type(screen.getByLabelText('The document'), 'EBM invoice');
    await user.click(screen.getByLabelText(/Required \(untick/));
    await user.click(screen.getByRole('button', { name: 'Create this draft' }));
    expect(JSON.parse(sent('POST', '/checklists')[0][1].body).items[0].required).toBe(false);
  });

  it('goes to the saved checklist afterwards', async () => {
    const user = u();
    show('/admin/checklists/new', { stubSaved: true });
    await user.type(screen.getByLabelText('Title'), 'Buying a car');
    await user.click(screen.getByRole('button', { name: 'Add a document' }));
    await user.type(screen.getByLabelText('The document'), 'Yellow card');
    await user.click(screen.getByRole('button', { name: 'Create this draft' }));
    expect(await screen.findByText('Edit page nine')).toBeInTheDocument();
  });

  it('never sends a status or a verifier, so a checklist cannot be published from here', async () => {
    const user = u();
    show('/admin/checklists/new');
    await user.type(screen.getByLabelText('Title'), 'Buying a car');
    await user.click(screen.getByRole('button', { name: 'Add a document' }));
    await user.type(screen.getByLabelText('The document'), 'Yellow card');
    await user.click(screen.getByRole('button', { name: 'Create this draft' }));
    const body = JSON.parse(sent('POST', '/checklists')[0][1].body);
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('verified_by');
    expect(screen.queryByRole('button', { name: /publish|verify/i })).not.toBeInTheDocument();
  });
});

describe('Edit a checklist', () => {
  it('starts from the saved checklist, so saving without a change sends it back whole', async () => {
    const user = u();
    show('/admin/checklists/3');
    expect(await screen.findByLabelText('Title')).toHaveValue('Buying a car');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const body = JSON.parse(sent('PUT', '/checklists/3')[0][1].body);
    expect(body).toEqual({
      slug: 'buying-a-car', title: 'Buying a car', description: 'What RRA asks for.',
      items: list({}).items,
    });
  });

  it('says so when the checklist does not exist', async () => {
    show('/admin/checklists/77');
    expect(await screen.findByText('That checklist does not exist.')).toBeInTheDocument();
  });
});

describe('A published checklist', () => {
  beforeEach(() => { lists = [list({ status: 'published' })]; });

  it('warns that saving takes it back to draft and off the site', async () => {
    show('/admin/checklists/3');
    expect(await screen.findByText(/leaves the site until it is published again/)).toBeInTheDocument();
  });

  it('sends no request at all until the admin says they understand', async () => {
    const user = u();
    show('/admin/checklists/3');
    await screen.findByLabelText('I understand');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(sent('PUT', '/checklists/3')).toHaveLength(0);
    expect(await screen.findByText(/Tick the box to say you understand/)).toBeInTheDocument();
  });

  it('saves once the box is ticked', async () => {
    const user = u();
    show('/admin/checklists/3');
    await user.click(await screen.findByLabelText('I understand'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(sent('PUT', '/checklists/3')).toHaveLength(1);
  });

  it('does not show the warning for a draft, so it is not one people click through', async () => {
    lists = [list({})];
    show('/admin/checklists/3');
    await screen.findByLabelText('Title');
    expect(screen.queryByLabelText('I understand')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminContacts from '@/pages/AdminContacts';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

let contacts;

beforeEach(() => {
  contacts = [
    { id: 1, name: 'Police', contact: '112', when_to_use: 'Immediate danger', sort_order: 10 },
    { id: 2, name: 'Isange One Stop Centre', contact: '3029', when_to_use: 'Abuse or harassment', sort_order: 20 },
  ];
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/admin/emergency-contacts') return reply(200, contacts);
    if (options.method === 'DELETE') return { ok: true, status: 204, headers: { get: () => null } };
    return reply(200, {});
  });
});

const show = () => render(<MemoryRouter><AdminContacts /></MemoryRouter>);
const u = () => userEvent.setup({ delay: null });
const sent = (method, suffix) => global.fetch.mock.calls.filter(([url, o]) => o.method === method && String(url).endsWith(suffix));
const row = async (name) => within((await screen.findByRole('heading', { name })).closest('li'));

describe('Crisis contacts', () => {
  it('lists the contacts in the order the server sent them', async () => {
    show();
    const names = (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent);
    expect(names).toEqual(['Police', 'Isange One Stop Centre']);
    expect((await row('Police')).getByText('112')).toBeInTheDocument();
  });

  it('says the page is never empty even if every contact is deleted', async () => {
    show();
    await screen.findByRole('heading', { name: 'Police' });
    expect(screen.getByText(/shows a built-in list so it is never empty/)).toBeInTheDocument();
  });

  it('says so when no contact is saved', async () => {
    contacts = [];
    show();
    expect(await screen.findByText(/showing the built-in list/)).toBeInTheDocument();
  });

  it('starts an edit from what is saved and sends the order as a number', async () => {
    const user = u();
    show();
    await user.click((await row('Police')).getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Number or website')).toHaveValue('112');
    expect(screen.getByLabelText('Order on the page')).toHaveValue(10);
    const when = screen.getByLabelText('When to use it');
    await user.clear(when);
    await user.type(when, 'Danger right now');
    await user.click(screen.getByRole('button', { name: 'Save contact' }));
    const [[, options]] = sent('PUT', '/admin/emergency-contacts/1');
    expect(JSON.parse(options.body)).toEqual({ name: 'Police', contact: '112', when_to_use: 'Danger right now', sort_order: 10 });
  });

  it('adds a contact', async () => {
    const user = u();
    show();
    await user.click(await screen.findByRole('button', { name: 'Add a contact' }));
    await user.type(screen.getByLabelText('Name'), 'A new line');
    await user.type(screen.getByLabelText('Number or website'), '0000');
    await user.type(screen.getByLabelText('When to use it'), 'Any time');
    await user.click(screen.getByRole('button', { name: 'Save contact' }));
    const [[, options]] = sent('POST', '/admin/emergency-contacts');
    expect(JSON.parse(options.body)).toEqual({ name: 'A new line', contact: '0000', when_to_use: 'Any time', sort_order: 100 });
  });

  it('asks before deleting and deletes nothing when the reader keeps it', async () => {
    const user = u();
    show();
    const police = await row('Police');
    await user.click(police.getByRole('button', { name: 'Delete' }));
    expect(police.getByText(/disappears from the urgent help page at once/)).toBeInTheDocument();
    await user.click(police.getByRole('button', { name: 'Keep contact' }));
    expect(sent('DELETE', '/admin/emergency-contacts/1')).toHaveLength(0);
  });

  it('deletes after confirmation', async () => {
    const user = u();
    show();
    const police = await row('Police');
    await user.click(police.getByRole('button', { name: 'Delete' }));
    await user.click(police.getByRole('button', { name: 'Delete contact record' }));
    expect(sent('DELETE', '/admin/emergency-contacts/1')).toHaveLength(1);
  });

  it('shows the server message and keeps the form open when a save is refused', async () => {
    global.fetch.mockImplementation(async (url, options) => {
      if (options.method === 'GET') return reply(200, contacts);
      return reply(400, { error: 'name, contact and when_to_use are all required' });
    });
    const user = u();
    show();
    await user.click(await screen.findByRole('button', { name: 'Add a contact' }));
    await user.click(screen.getByRole('button', { name: 'Save contact' }));
    expect(await screen.findByText('name, contact and when_to_use are all required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save contact' })).toBeEnabled();
  });

  it('closes the form on cancel without sending anything', async () => {
    const user = u();
    show();
    await user.click(await screen.findByRole('button', { name: 'Add a contact' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Add a contact' })).toBeInTheDocument();
    expect(sent('POST', '/admin/emergency-contacts')).toHaveLength(0);
  });
});

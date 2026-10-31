import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminProviders from '@/pages/AdminProviders';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

let providers;

beforeEach(() => {
  providers = [
    {
      id: 1, name: 'Example Pro Bono Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', location: 'Kigali',
      contact: 'Phone number on file', services: 'Free advice.', languages: 'English', is_free: true,
      official_source_url: 'https://example.org/office', bookable: true, meet_link: 'https://meet.google.com/abc',
      user_id: 9, status: 'published', stale: false,
    },
    {
      id: 2, name: 'Example Legal Aid Office', category: 'organisation', type: 'maj_office', location: null,
      contact: null, services: null, languages: null, is_free: true, official_source_url: null, bookable: false,
      meet_link: null, user_id: null, status: 'draft', stale: false,
    },
  ];
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/directory/providers/all') return reply(200, providers);
    return reply(200, {});
  });
});

const show = () => render(<MemoryRouter><AdminProviders /></MemoryRouter>);
const u = () => userEvent.setup({ delay: null });
const sent = (method, suffix) => global.fetch.mock.calls.filter(([url, o]) => o.method === method && String(url).endsWith(suffix));
const row = async (name) => within((await screen.findByRole('heading', { name })).closest('li'));

describe('Manage directory', () => {
  it('lists the entries with their state and the account behind each', async () => {
    show();
    const first = await row('Example Pro Bono Lawyer');
    expect(first.getByText('Published')).toBeInTheDocument();
    expect(first.getByText('Account 9')).toBeInTheDocument();
    const second = await row('Example Legal Aid Office');
    expect(second.getByText('No account linked')).toBeInTheDocument();
  });

  it('offers to publish only a draft', async () => {
    show();
    expect((await row('Example Pro Bono Lawyer')).queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect((await row('Example Legal Aid Office')).getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('publishes a draft', async () => {
    const user = u();
    show();
    await user.click((await row('Example Legal Aid Office')).getByRole('button', { name: 'Publish' }));
    expect(sent('POST', '/directory/providers/2/publish')).toHaveLength(1);
  });

  it('shows the saved values when editing, including the account', async () => {
    const user = u();
    show();
    await user.click((await row('Example Pro Bono Lawyer')).getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Example Pro Bono Lawyer');
    expect(screen.getByLabelText('Expert account number')).toHaveValue(9);
    expect(screen.getByLabelText('It takes online bookings')).toBeChecked();
    expect(screen.getByLabelText('Video room address')).toHaveValue('https://meet.google.com/abc');
  });

  it('keeps the account when only a phone number is edited', async () => {
    const user = u();
    show();
    await user.click((await row('Example Pro Bono Lawyer')).getByRole('button', { name: 'Edit' }));
    const contact = screen.getByLabelText('How to reach it');
    await user.clear(contact);
    await user.type(contact, 'New number');
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    const [[, options]] = sent('PUT', '/directory/providers/1');
    expect(JSON.parse(options.body)).toMatchObject({ contact: 'New number', user_id: 9, bookable: true });
  });

  it('unlinks the account only when the box is emptied on purpose', async () => {
    const user = u();
    show();
    await user.click((await row('Example Pro Bono Lawyer')).getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Expert account number'));
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(JSON.parse(sent('PUT', '/directory/providers/1')[0][1].body).user_id).toBeNull();
  });

  it('warns that a change to a checked fact sends a published entry back for review', async () => {
    const user = u();
    show();
    await user.click((await row('Example Pro Bono Lawyer')).getByRole('button', { name: 'Edit' }));
    expect(screen.getByText(/sends it back for review/)).toBeInTheDocument();
  });

  it('adds a new entry and closes the form', async () => {
    const user = u();
    show();
    await user.click(await screen.findByRole('button', { name: 'Add an entry' }));
    await user.type(screen.getByLabelText('Name'), 'A new office');
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    const [[, options]] = sent('POST', '/directory/providers');
    expect(JSON.parse(options.body)).toMatchObject({ name: 'A new office', category: 'lawyer', user_id: null, bookable: false });
    await screen.findByRole('button', { name: 'Add an entry' });
    expect(screen.queryByRole('form', { name: 'New entry' })).not.toBeInTheDocument();
  });

  it('closes the form on cancel without sending anything', async () => {
    const user = u();
    show();
    await user.click(await screen.findByRole('button', { name: 'Add an entry' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Add an entry' })).toBeInTheDocument();
    expect(sent('POST', '/directory/providers')).toHaveLength(0);
  });

  it('shows the server message and keeps the form open', async () => {
    global.fetch.mockImplementation(async (url, options) => {
      if (options.method === 'GET') return reply(200, providers);
      return reply(400, { error: 'name is required' });
    });
    const user = u();
    show();
    await user.click(await screen.findByRole('button', { name: 'Add an entry' }));
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(await screen.findByText('name is required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save entry' })).toBeEnabled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminRoutes from '@/pages/AdminRoutes';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

let routes;

beforeEach(() => {
  routes = [
    {
      id: 4, matter_type: 'deposit_kept', title: 'My landlord kept my deposit', keywords: 'rent flat',
      first_forum_id: 1, first_forum_name: 'Example Abunzi Committee', first_forum_status: 'published',
      legal_basis: 'A lease is a contract.', exclusions: null, steps: ['Write to the landlord', 'Go to the committee'],
      deadline_days: 30, deadline_runs_from: 'the day you left', deadline_note: null, status: 'published',
    },
    {
      id: 5, matter_type: 'dismissed', title: 'I was dismissed', keywords: '', first_forum_id: 2,
      first_forum_name: 'Example Labour Inspector', first_forum_status: 'draft', legal_basis: 'The labour law.',
      exclusions: null, steps: ['Write a complaint'], deadline_days: null, deadline_runs_from: null, deadline_note: null,
      status: 'draft',
    },
  ];
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/directory/routes/all') return reply(200, routes);
    if (options.method === 'GET' && path === '/directory/providers/all') {
      return reply(200, [{ id: 1, name: 'Example Abunzi Committee' }, { id: 2, name: 'Example Labour Inspector' }]);
    }
    return reply(200, {});
  });
});

const show = () => render(<MemoryRouter><AdminRoutes /></MemoryRouter>);
const u = () => userEvent.setup({ delay: null });
const sent = (method, suffix) => global.fetch.mock.calls.filter(([url, o]) => o.method === method && String(url).endsWith(suffix));
const row = async (name) => within((await screen.findByRole('heading', { name })).closest('li'));

describe('Manage routes', () => {
  it('lists the routes with the first office and the deadline in words', async () => {
    show();
    const first = await row('My landlord kept my deposit');
    expect(first.getByText(/First office: Example Abunzi Committee/)).toHaveTextContent('30 days from the day you left');
  });

  it('says plainly when a route is hidden because its office is not published', async () => {
    show();
    const second = await row('I was dismissed');
    expect(second.getByText(/not published yet, so this route stays hidden/)).toBeInTheDocument();
  });

  it('offers to publish only a draft', async () => {
    show();
    expect((await row('My landlord kept my deposit')).queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect((await row('I was dismissed')).getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('publishes a draft', async () => {
    const user = u();
    show();
    await user.click((await row('I was dismissed')).getByRole('button', { name: 'Publish' }));
    expect(sent('POST', '/directory/routes/5/publish')).toHaveLength(1);
  });

  it('shows the steps one on each line when editing and offers every office', async () => {
    const user = u();
    show();
    await user.click((await row('I was dismissed')).getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText(/What happens next/)).toHaveValue('Write a complaint');
    expect(await screen.findByRole('option', { name: 'Example Labour Inspector' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Example Abunzi Committee' })).toBeInTheDocument();
  });

  it('saves a draft with the steps as a list and the numbers as numbers', async () => {
    const user = u();
    show();
    await user.click((await row('I was dismissed')).getByRole('button', { name: 'Edit' }));
    await screen.findByRole('option', { name: 'Example Labour Inspector' });
    const steps = screen.getByLabelText(/What happens next/);
    await user.clear(steps);
    await user.type(steps, 'First step{enter}{enter}Second step');
    await user.type(screen.getByLabelText(/Days to act/), '45');
    await user.type(screen.getByLabelText('The days run from'), 'the day you were told');
    await user.click(screen.getByRole('button', { name: 'Save route' }));
    const body = JSON.parse(sent('PUT', '/directory/routes/5')[0][1].body);
    expect(body).toMatchObject({
      steps: ['First step', 'Second step'], deadline_days: 45, first_forum_id: 2, deadline_runs_from: 'the day you were told',
    });
  });

  it('lets the admin pick the area of law and sends it', async () => {
    const user = u();
    show();
    await user.click((await row('I was dismissed')).getByRole('button', { name: 'Edit' }));
    await screen.findByRole('option', { name: 'Example Labour Inspector' });
    const select = screen.getByLabelText('Area of law');
    expect([...select.options].map((o) => o.textContent)).toEqual(
      ['No area', 'Renting', 'Work', 'Business', 'Immigration', 'Harassment', 'Cars and driving']);
    await user.selectOptions(select, 'employment');
    await user.click(screen.getByRole('button', { name: 'Save route' }));
    expect(JSON.parse(sent('PUT', '/directory/routes/5')[0][1].body).area).toBe('employment');
  });

  it('starts from the saved area and sends it empty when there is none', async () => {
    routes[0].area = 'tenancy';
    const user = u();
    show();
    await user.click((await row('My landlord kept my deposit')).getByRole('button', { name: 'Edit' }));
    expect(await screen.findByLabelText('Area of law')).toHaveValue('tenancy');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click((await row('I was dismissed')).getByRole('button', { name: 'Edit' }));
    await screen.findByRole('option', { name: 'Example Labour Inspector' });
    expect(screen.getByLabelText('Area of law')).toHaveValue('');
  });

  it('sends a missing deadline as null', async () => {
    const user = u();
    show();
    await user.click((await row('I was dismissed')).getByRole('button', { name: 'Edit' }));
    await screen.findByRole('option', { name: 'Example Labour Inspector' });
    await user.click(screen.getByRole('button', { name: 'Save route' }));
    expect(JSON.parse(sent('PUT', '/directory/routes/5')[0][1].body).deadline_days).toBeNull();
  });

  it('sends no request for a published route until the admin says they understand', async () => {
    const user = u();
    show();
    await user.click((await row('My landlord kept my deposit')).getByRole('button', { name: 'Edit' }));
    await screen.findByRole('option', { name: 'Example Labour Inspector' });
    await user.click(screen.getByRole('button', { name: 'Save route' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Tick the box');
    expect(sent('PUT', '/directory/routes/4')).toHaveLength(0);
    await user.click(screen.getByLabelText('I understand'));
    await user.click(screen.getByRole('button', { name: 'Save route' }));
    expect(sent('PUT', '/directory/routes/4')).toHaveLength(1);
  });

  it('adds a new route', async () => {
    const user = u();
    show();
    await user.click(await screen.findByRole('button', { name: 'Add a route' }));
    await user.type(screen.getByLabelText('Matter code'), 'new_matter');
    await user.click(screen.getByRole('button', { name: 'Save route' }));
    const body = JSON.parse(sent('POST', '/directory/routes')[0][1].body);
    expect(body).toMatchObject({ matter_type: 'new_matter', first_forum_id: null, steps: [], deadline_days: null });
  });

  it('shows the server message and keeps the form open', async () => {
    global.fetch.mockImplementation(async (url, options) => {
      const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
      if (options.method === 'GET') return reply(200, path.endsWith('/routes/all') ? routes : []);
      return reply(409, { error: 'A route for that matter_type already exists' });
    });
    const user = u();
    show();
    await user.click(await screen.findByRole('button', { name: 'Add a route' }));
    await user.click(screen.getByRole('button', { name: 'Save route' }));
    expect(await screen.findByText('A route for that matter_type already exists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save route' })).toBeEnabled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminInvites from '@/pages/AdminInvites';
import { findRows } from '../rows';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const INVITES = [
  { id: 1, email: 'waiting@example.org', status: 'pending', invited_by: 'Test Admin', created_at: '2026-09-01T00:00:00Z', expires_at: '2026-09-08T00:00:00Z', used_at: null },
  { id: 2, email: 'joined@example.org', status: 'used', invited_by: 'Test Admin', created_at: '2026-08-01T00:00:00Z', expires_at: '2026-08-08T00:00:00Z', used_at: '2026-08-02T00:00:00Z' },
  { id: 3, email: 'late@example.org', status: 'expired', invited_by: 'Test Admin', created_at: '2026-07-01T00:00:00Z', expires_at: '2026-07-08T00:00:00Z', used_at: null },
];

let postReply;

beforeEach(() => {
  postReply = async () => reply(201, { id: 9, message: 'The invitation was sent to new@example.org.' });
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/admin/invites') return reply(200, INVITES);
    return postReply();
  });
});

const show = () => render(<MemoryRouter><AdminInvites /></MemoryRouter>);
const u = () => userEvent.setup({ delay: null });
const posted = () => global.fetch.mock.calls.filter(([, o]) => o.method === 'POST');

describe('Invitations', () => {
  it('lists the invitations with their state in words', async () => {
    show();
    const list = await findRows();
    expect(within(list[0]).getByText('Waiting')).toBeInTheDocument();
    expect(within(list[1]).getByText('Used')).toBeInTheDocument();
    expect(within(list[2]).getByText('Expired')).toBeInTheDocument();
  });

  it('shows who invited and when the invitation ends or was used', async () => {
    show();
    const list = await findRows();
    expect(list[0]).toHaveTextContent(/Invited by Test Admin/);
    expect(list[0]).toHaveTextContent(/lasts until/);
    expect(list[1]).toHaveTextContent(/used /);
  });

  it('explains the next step of linking the expert’s account to their entry', async () => {
    show();
    await findRows();
    expect(screen.getByText(/link their account to their directory entry/)).toBeInTheDocument();
  });

  it('asks for an address and sends nothing without one', async () => {
    show();
    await u().click(await screen.findByRole('button', { name: 'Send the invitation' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the email address to invite.');
    expect(posted()).toHaveLength(0);
  });

  it('sends the invitation with the number of days and shows the server message', async () => {
    const user = u();
    show();
    await user.type(await screen.findByLabelText('Email address'), '  new@example.org ');
    await user.click(screen.getByRole('button', { name: 'Send the invitation' }));
    expect(await screen.findByText('The invitation was sent to new@example.org.')).toBeInTheDocument();
    expect(JSON.parse(posted()[0][1].body)).toEqual({ email: 'new@example.org', expires_days: 7 });
    expect(screen.getByLabelText('Email address')).toHaveValue('');
  });

  it('sends the days that were chosen', async () => {
    const user = u();
    show();
    await user.type(await screen.findByLabelText('Email address'), 'new@example.org');
    const days = screen.getByLabelText('Days the invitation lasts');
    await user.clear(days);
    await user.type(days, '14');
    await user.click(screen.getByRole('button', { name: 'Send the invitation' }));
    await screen.findByRole('status');
    expect(JSON.parse(posted()[0][1].body).expires_days).toBe(14);
  });

  it('shows the server message when the address already has an account', async () => {
    postReply = async () => reply(400, { error: 'An account with this email already exists' });
    const user = u();
    show();
    await user.type(await screen.findByLabelText('Email address'), 'taken@example.org');
    await user.click(screen.getByRole('button', { name: 'Send the invitation' }));
    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
  });

  it('never shows an invitation code on the page', async () => {
    show();
    await findRows();
    expect(document.body.textContent).not.toMatch(/token|code:/i);
  });

  it('says so when no invitation has been sent', async () => {
    global.fetch.mockImplementation(async () => reply(200, []));
    show();
    expect(await screen.findByText('No invitations have been sent.')).toBeInTheDocument();
  });
});

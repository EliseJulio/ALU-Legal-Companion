import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminUsers from '@/pages/AdminUsers';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const PEOPLE = [
  { id: 1, name: 'Test Admin', email: 'admin@example.org', role: 'admin', email_verified_at: '2026-09-01T00:00:00Z', deactivated_at: null, created_at: '2026-09-01T00:00:00Z' },
  { id: 2, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student', email_verified_at: '2026-09-02T00:00:00Z', deactivated_at: null, created_at: '2026-09-02T00:00:00Z' },
  { id: 3, name: 'Test Expert', email: 'expert@example.org', role: 'legal_expert', email_verified_at: '2026-09-03T00:00:00Z', deactivated_at: null, created_at: '2026-09-03T00:00:00Z' },
  { id: 4, name: 'Old Student', email: 'old@alustudent.com', role: 'student', email_verified_at: '2026-09-04T00:00:00Z', deactivated_at: '2026-09-10T00:00:00Z', created_at: '2026-09-04T00:00:00Z' },
  { id: 5, name: 'New Staff', email: 'new@alueducation.com', role: 'staff', email_verified_at: null, deactivated_at: null, created_at: '2026-09-05T00:00:00Z' },
];

let actionReply;

beforeEach(() => {
  clearSession();
  localStorage.clear();
  saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Admin', email: 'admin@example.org', role: 'admin' } });
  actionReply = async () => reply(200, {});
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/admin/users') return reply(200, PEOPLE);
    return actionReply(path, options);
  });
});

const show = () => render(<MemoryRouter><AuthProvider><AdminUsers /></AuthProvider></MemoryRouter>);
const u = () => userEvent.setup({ delay: null });
const sent = (method, suffix) => global.fetch.mock.calls.filter(([url, o]) => o.method === method && String(url).endsWith(suffix));
const row = async (name) => within((await screen.findByRole('heading', { name })).closest('li'));

describe('People', () => {
  it('shows each account’s state in words', async () => {
    show();
    expect((await row('Test Student')).getByText('Active')).toBeInTheDocument();
    expect((await row('Old Student')).getByText('Switched off')).toBeInTheDocument();
    expect((await row('New Staff')).getByText('Email not confirmed')).toBeInTheDocument();
  });

  it('shows the role in words and the account number', async () => {
    show();
    const expert = await row('Test Expert');
    expect(expert.getByText(/Legal expert · Account 3/)).toBeInTheDocument();
  });

  it('shows nothing about what a person asked or booked', async () => {
    show();
    await row('Test Student');
    expect(document.body.textContent).not.toMatch(/questions asked|appointments|bookings/i);
    expect(document.body.textContent).not.toMatch(/password|hash/i);
  });

  it('marks the signed-in admin and will not let them switch themselves off', async () => {
    show();
    const me = await row('Test Admin');
    expect(me.getByText(/This is you/)).toBeInTheDocument();
    expect(me.queryByRole('button', { name: 'Switch off' })).not.toBeInTheDocument();
    expect(me.getByText(/cannot switch off your own account/)).toBeInTheDocument();
  });

  it('never offers legal expert as a role and leaves an expert’s role fixed', async () => {
    show();
    const student = await row('Test Student');
    const options = student.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Student', 'Staff', 'Administrator']);
    const expert = await row('Test Expert');
    expect(expert.queryByRole('combobox')).not.toBeInTheDocument();
    expect(expert.getByText(/role cannot be changed/)).toBeInTheDocument();
  });

  it('keeps Change role off until a different role is chosen, then sends it', async () => {
    const user = u();
    show();
    const student = await row('Test Student');
    const button = student.getByRole('button', { name: 'Change role' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.selectOptions(student.getByLabelText('Role of Test Student'), 'staff');
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    const [[, options]] = sent('PUT', '/admin/users/2/role');
    expect(JSON.parse(options.body)).toEqual({ role: 'staff' });
  });

  it('switches an account off and on again', async () => {
    const user = u();
    show();
    await user.click((await row('Test Student')).getByRole('button', { name: 'Switch off' }));
    expect(sent('POST', '/admin/users/2/deactivate')).toHaveLength(1);
    await user.click((await row('Old Student')).getByRole('button', { name: 'Switch on again' }));
    expect(sent('POST', '/admin/users/4/reactivate')).toHaveLength(1);
  });

  it('shows the server’s reason beside the person when a change is refused', async () => {
    actionReply = async () => reply(400, { error: 'This is the last active admin. Promote another account to admin first.' });
    const user = u();
    show();
    const student = await row('Test Student');
    await user.selectOptions(student.getByLabelText('Role of Test Student'), 'admin');
    await user.click(student.getByRole('button', { name: 'Change role' }));
    expect(await student.findByText(/last active admin/)).toBeInTheDocument();
    expect(within((await screen.findByRole('heading', { name: 'New Staff' })).closest('li')).queryByText(/last active admin/)).not.toBeInTheDocument();
  });

  it('shows the server message when the list cannot be loaded', async () => {
    global.fetch.mockImplementation(async () => reply(500, { error: 'The server is busy.' }));
    show();
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
  });
});

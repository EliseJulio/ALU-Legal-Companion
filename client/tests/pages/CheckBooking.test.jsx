import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CheckBooking from '@/pages/CheckBooking';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const BOOKING = {
  id: 3, slot: '2099-01-01T08:00:00.000Z', topic: 'My deposit', status: 'accepted',
  provider_name: 'Example Pro Bono Lawyer', meet_link: 'https://meet.example.org/abc',
};

const show = () => render(<MemoryRouter><CheckBooking /></MemoryRouter>);

async function lookUp(code) {
  const user = userEvent.setup({ delay: null });
  if (code) await user.type(screen.getByLabelText('Your booking code'), code);
  await user.click(screen.getByRole('button', { name: 'Check booking' }));
}

beforeEach(() => {
  clearSession();
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(reply(200, BOOKING));
});

describe('Check a booking', () => {
  it('asks for a code and sends nothing when there is none', async () => {
    show();
    await lookUp('');
    expect(screen.getByRole('alert')).toHaveTextContent(/Type the code you were given/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('puts the code in the path of one request and never in the address bar', async () => {
    show();
    await lookUp('1234-5678-9abc-defg');
    await screen.findByText('Example Pro Bono Lawyer');
    expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/bookings\/anon\/1234-5678-9abc-defg$/);
    expect(window.location.href).not.toMatch(/1234/i);
  });

  it('shows the status as a word beside the heading', async () => {
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    expect(await screen.findByText('Accepted')).toBeInTheDocument();
  });

  it('tells a reader with no connection to keep the code and try again', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    expect(await screen.findByText(/Try again when you have a connection/)).toBeInTheDocument();
  });

  it('sends the request without a login even when someone is signed in', async () => {
    saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'a@example.org', role: 'student' } });
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    await screen.findByText('Example Pro Bono Lawyer');
    expect(global.fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('explains an accepted booking and shows how to join', async () => {
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    expect(await screen.findByRole('heading', { name: 'The lawyer agreed to this time' })).toBeInTheDocument();
    expect(screen.getByText('My deposit')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Join the video call/ })).toHaveAttribute('href', 'https://meet.example.org/abc');
  });

  it('explains a request that is still waiting and shows no room', async () => {
    global.fetch.mockResolvedValue(reply(200, { ...BOOKING, status: 'requested', meet_link: null }));
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    expect(await screen.findByRole('heading', { name: 'Waiting for the lawyer to reply' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Join the video call/ })).not.toBeInTheDocument();
  });

  it('offers another lawyer after a declined booking', async () => {
    global.fetch.mockResolvedValue(reply(200, { ...BOOKING, status: 'declined', meet_link: null }));
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    expect(await screen.findByRole('link', { name: 'Ask another lawyer in the directory' })).toHaveAttribute('href', '/directory');
  });

  it('shows the server message for a code that matches nothing', async () => {
    global.fetch.mockResolvedValue(reply(404, { error: 'No booking found for this token' }));
    show();
    await lookUp('0000-0000-0000-0000');
    expect(await screen.findByText('No booking found for this token')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });
});

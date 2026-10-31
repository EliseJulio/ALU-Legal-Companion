import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpertMatters from '@/pages/ExpertMatters';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const show = () => render(<MemoryRouter><ExpertMatters /></MemoryRouter>);

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(reply(200, [
    { id: 7, title: 'Deposit from my old flat', status: 'open', route_title: 'My landlord kept my deposit', next_due: '2099-01-10' },
  ]));
});

describe('Shared matters', () => {
  it('lists each matter with a link to open it and shows the deadline', async () => {
    show();
    const link = await screen.findByRole('link', { name: /Deposit from my old flat/ });
    expect(link).toHaveAttribute('href', '/matters/7');
    expect(link).toHaveTextContent('My landlord kept my deposit');
    expect(link).toHaveTextContent(/Deadline .* \(in \d+ days\)/);
    expect(link).toHaveTextContent('Open');
  });

  it('says the owner is not named', async () => {
    show();
    await screen.findByRole('link', { name: /Deposit from my old flat/ });
    expect(screen.getByText(/do not see who shared it/)).toBeInTheDocument();
  });

  it('says how many documents wait for the check, so the lawyer need not open each matter', async () => {
    global.fetch.mockResolvedValue(reply(200, [
      { id: 7, title: 'Deposit from my old flat', status: 'open', documents_waiting: 2 },
      { id: 8, title: 'A job contract', status: 'open', documents_waiting: 1 },
      { id: 9, title: 'A closed matter', status: 'closed', documents_waiting: 0 },
    ]));
    show();
    expect(await screen.findByText('2 documents waiting for your check')).toBeInTheDocument();
    expect(screen.getByText('1 document waiting for your check')).toBeInTheDocument();
    expect(screen.getAllByText(/waiting for your check/)).toHaveLength(2);
  });

  it('says nothing about waiting when the server sends no count', async () => {
    show();
    await screen.findByRole('link', { name: /Deposit from my old flat/ });
    expect(screen.queryByText(/waiting for your check/)).not.toBeInTheDocument();
  });

  it('says so when nobody is sharing', async () => {
    global.fetch.mockResolvedValue(reply(200, []));
    show();
    expect(await screen.findByText(/Nobody is sharing a matter with you/)).toBeInTheDocument();
  });

  it('shows the server message when the list cannot be loaded', async () => {
    global.fetch.mockResolvedValue(reply(500, { error: 'The server is busy.' }));
    show();
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
  });
});

describe('Shared matters: the page as designed', () => {
  it('says what a shared record is and that the member can take it back', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Records shared with you.' })).toBeInTheDocument();
    await screen.findByRole('link', { name: /Deposit from my old flat/ });
    expect(screen.getByText('Shared record only. No member name or email.')).toBeInTheDocument();
    expect(screen.getByText('The member can revoke access immediately.')).toBeInTheDocument();
  });
});

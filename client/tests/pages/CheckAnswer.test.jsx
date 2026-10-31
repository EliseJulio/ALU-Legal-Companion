import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CheckAnswer from '@/pages/CheckAnswer';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const QUESTION = { id: 3, text: 'Can my landlord keep my deposit?', answer: null, status: 'open' };

const show = () => render(<MemoryRouter><CheckAnswer /></MemoryRouter>);

async function lookUp(code) {
  const user = userEvent.setup({ delay: null });
  if (code) await user.type(screen.getByLabelText('Your question code'), code);
  await user.click(screen.getByRole('button', { name: 'Check for answer' }));
}

beforeEach(() => {
  clearSession();
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(reply(200, QUESTION));
});

describe('Check for your answer', () => {
  it('asks for a code and sends nothing when there is none', async () => {
    show();
    await lookUp('');
    expect(screen.getByRole('alert')).toHaveTextContent(/Type the code you were given/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('puts the code in the path of one request and never in the address bar', async () => {
    show();
    await lookUp('1234-5678-9abc-defg');
    await screen.findByText('Awaiting a response');
    expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/questions\/anon\/1234-5678-9abc-defg$/);
    expect(window.location.href).not.toMatch(/1234/i);
  });

  it('sends the request without a login even when someone is signed in', async () => {
    saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'a@example.org', role: 'student' } });
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    await screen.findByText('Awaiting a response');
    expect(global.fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('shows the question and says it is still waiting when there is no answer', async () => {
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    expect(await screen.findByRole('heading', { name: 'Awaiting a response' })).toBeInTheDocument();
    expect(screen.getByText('Can my landlord keep my deposit?')).toBeInTheDocument();
    expect(screen.getByText(/you do not need to send it again/)).toBeInTheDocument();
  });

  it('while waiting, can look again with the same code and points to emergency help', async () => {
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    await screen.findByRole('heading', { name: 'Awaiting a response' });
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText(/A response is not guaranteed/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Emergency help →' })).toHaveAttribute('href', '/emergency');
    global.fetch.mockResolvedValue(reply(200, { ...QUESTION, answer: 'Write to the landlord first.', status: 'answered' }));
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByText('Write to the landlord first.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String(global.fetch.mock.calls[1][0])).toMatch(/\/questions\/anon\/1234-5678-9ABC-DEFG$/);
  });

  it('keeps focus on Check again and drops an old result when the code is edited', async () => {
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    await screen.findByRole('heading', { name: 'Awaiting a response' });
    const again = screen.getByRole('button', { name: 'Check again' });
    again.focus();
    await userEvent.setup({ delay: null }).click(again);
    expect(await screen.findByRole('heading', { name: 'Awaiting a response' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toHaveFocus();
    await userEvent.setup({ delay: null }).type(screen.getByLabelText('Your question code'), 'x');
    expect(screen.queryByRole('heading', { name: 'Awaiting a response' })).toBeNull();
  });

  it('drops an old result when the box is emptied and checked again', async () => {
    show();
    const u = userEvent.setup({ delay: null });
    await lookUp('1234');
    await screen.findByRole('heading', { name: 'Awaiting a response' });
    await u.clear(screen.getByLabelText('Your question code'));
    await u.click(screen.getByRole('button', { name: 'Check for answer' }));
    expect(screen.queryByRole('heading', { name: 'Awaiting a response' })).toBeNull();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('tells a reader with no connection to keep the code and try again', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    expect(await screen.findByText(/Try again when you have a connection/)).toBeInTheDocument();
    expect(screen.getByText(/Keep the code you already saved/)).toBeInTheDocument();
  });

  it('says a lost code cannot be recovered before anything is typed', () => {
    show();
    expect(screen.getByText('Lost codes cannot be recovered or reissued.')).toBeInTheDocument();
    expect(screen.getByText(/Anonymous requests are not added/)).toBeInTheDocument();
  });

  it('shows the answer with the disclaimer when an expert has answered', async () => {
    global.fetch.mockResolvedValue(reply(200, { ...QUESTION, answer: 'Write to the landlord first.', status: 'answered' }));
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    expect(await screen.findByRole('heading', { name: 'A legal expert has answered' })).toBeInTheDocument();
    expect(screen.getByText('Write to the landlord first.')).toBeInTheDocument();
    expect(screen.getByText('Legal information not legal advice.')).toBeInTheDocument();
  });

  it('explains what to try for a code that matches nothing and offers a new question', async () => {
    global.fetch.mockResolvedValue(reply(404, { error: 'No question found for this token' }));
    show();
    await lookUp('0000-0000-0000-0000');
    expect(await screen.findByText('No question found for this token')).toBeInTheDocument();
    expect(screen.getByText('What to try next')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask your question again to get a new code' })).toHaveAttribute('href', '/ask');
  });

  it('shows only the server message for an error that is not a missing code', async () => {
    global.fetch.mockResolvedValue(reply(429, { error: 'Too many attempts. Please wait.' }));
    show();
    await lookUp('1234-5678-9ABC-DEFG');
    expect(await screen.findByText('Too many attempts. Please wait.')).toBeInTheDocument();
    expect(screen.queryByText('What to try next')).not.toBeInTheDocument();
  });
});

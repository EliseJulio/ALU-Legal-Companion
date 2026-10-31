import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ExpertQuestions from '@/pages/ExpertQuestions';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

let open;

beforeEach(() => {
  open = [
    { id: 1, text: 'Can my landlord keep my deposit?', created_at: '2026-09-02T09:00:00Z', kind: 'anonymous' },
    { id: 2, text: 'What is the notice period?', created_at: '2026-09-03T09:00:00Z', kind: 'signed-in' },
  ];
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/questions/open') return reply(200, open);
    if (options.method === 'POST' && path === '/questions/1/answer') {
      open = open.filter((q) => q.id !== 1);
      return reply(200, { id: 1, status: 'answered' });
    }
    return reply(404, { error: 'Question not found or already answered' });
  });
});

const show = () => render(<MemoryRouter><ExpertQuestions /></MemoryRouter>);
const list = () => within(screen.getByRole('list', { name: 'Open questions' }));

describe('Expert questions', () => {
  it('lists the open questions in the order sent and says only whether they are anonymous', async () => {
    show();
    await screen.findByRole('list', { name: 'Open questions' });
    const items = list().getAllByRole('button');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Can my landlord keep my deposit?');
    expect(items[1]).toHaveTextContent('What is the notice period?');
    expect(items[0]).toHaveTextContent('Anonymous question');
    expect(items[1]).toHaveTextContent('signed-in student or staff member');
  });

  it('shows the first question in full beside the list with one answer box', async () => {
    show();
    await screen.findByRole('list', { name: 'Open questions' });
    expect(list().getAllByRole('button')[0]).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { level: 2, name: /^The question/ })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Your written answer')).toHaveLength(1);
  });

  it('shows another question when it is chosen and starts it with an empty box', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('list', { name: 'Open questions' });
    await user.type(screen.getByLabelText('Your written answer'), 'half an answer');
    await user.click(list().getAllByRole('button')[1]);
    expect(list().getAllByRole('button')[1]).toHaveAttribute('aria-current', 'true');
    expect(screen.getByLabelText('Your written answer')).toHaveValue('');
    expect(screen.getByRole('heading', { level: 2, name: /^The question/ })).toHaveFocus();
  });

  it('will not send an empty answer', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await user.click(await screen.findByRole('button', { name: 'Send the answer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write the answer first.');
    expect(global.fetch.mock.calls.filter(([, o]) => o.method === 'POST')).toHaveLength(0);
  });

  it('sends the answer and the question leaves the list', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await user.type(await screen.findByLabelText('Your written answer'), '  Write to the landlord first. ');
    await user.click(screen.getByRole('button', { name: 'Send the answer' }));
    // The list reloads from the server, so the test waits for the answered question to go.
    await waitFor(() => expect(list().queryByText(/Can my landlord keep my deposit/)).not.toBeInTheDocument());
    expect(list().getByText(/What is the notice period/)).toBeInTheDocument();
    expect(screen.getByText('Answer sent.')).toBeInTheDocument();
    const [[, options]] = global.fetch.mock.calls.filter(([url, o]) => o.method === 'POST' && String(url).endsWith('/questions/1/answer'));
    expect(JSON.parse(options.body)).toEqual({ answer: 'Write to the landlord first.' });
  });

  it('shows the server message when the question was already answered', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await screen.findByRole('list', { name: 'Open questions' });
    await user.click(list().getAllByRole('button')[1]);
    await user.type(screen.getByLabelText('Your written answer'), 'An answer');
    await user.click(screen.getByRole('button', { name: 'Send the answer' }));
    expect(await screen.findByText('Question not found or already answered')).toBeInTheDocument();
  });

  it('says so when nothing is waiting', async () => {
    open = [];
    show();
    expect(await screen.findByText('No questions are waiting.')).toBeInTheDocument();
  });

  it('reminds the expert that free text can identify a person and that this is not legal advice', async () => {
    show();
    await screen.findByRole('list', { name: 'Open questions' });
    expect(screen.getByText('Minimise identifying information')).toBeInTheDocument();
    expect(screen.getByText(/Account identity is not shown/)).toBeInTheDocument();
    expect(screen.getByText(/Legal information, not legal advice/)).toBeInTheDocument();
  });

  it('says it is oldest first and what the heading promises', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Questions from the community.' })).toBeInTheDocument();
    expect(screen.getByText(/Oldest first/)).toBeInTheDocument();
  });
});

describe('Expert questions: focus after an answer', () => {
  it('does not move focus on first load', async () => {
    show();
    await screen.findByRole('list', { name: 'Open questions' });
    expect(document.body).toHaveFocus();
  });

  it('puts focus on the message once the answer is sent and the question has left', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await user.type(await screen.findByLabelText('Your written answer'), 'Write to the landlord first.');
    await user.click(screen.getByRole('button', { name: 'Send the answer' }));
    const message = await screen.findByText('Answer sent.');
    await waitFor(() => expect(message).toHaveFocus());
  });
});

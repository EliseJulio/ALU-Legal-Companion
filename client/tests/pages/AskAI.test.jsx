import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AskAI from '@/pages/AskAI';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const asks = () => global.fetch.mock.calls.filter(([url, o]) => String(url).endsWith('/ask-ai') && o.method === 'POST');

// The server and the model are replaced by fixed answers. Nothing leaves the test.
function stub({ available = true, ask = reply(200, { answer: 'Short answer.', sources: [] }) } = {}) {
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (path === '/ask-ai/status') return reply(200, { available });
    if (path === '/ask-ai' && options.method === 'POST') return ask;
    return reply(200, []);
  });
}

function show(query = '') {
  return render(
    <MemoryRouter initialEntries={[`/ask-ai${query}`]}>
      <Routes>
        <Route path="/ask-ai" element={<AskAI />} />
      </Routes>
    </MemoryRouter>,
  );
}

const user = () => userEvent.setup({ delay: null });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('Ask AI', () => {
  it('sends nothing until the person ticks I understand', async () => {
    stub();
    show('?q=How can I renew my student permit');
    const u = user();
    const box = await screen.findByLabelText('Your question');
    expect(box).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Ask' }));
    await settle();
    expect(asks()).toHaveLength(0);
    await u.click(screen.getByRole('checkbox', { name: 'I understand' }));
    await u.click(screen.getByRole('button', { name: 'Ask' }));
    await settle();
    expect(asks()).toHaveLength(1);
  });

  it('says plainly that it is not available when the model is not set up', async () => {
    stub({ available: false });
    show();
    expect(await screen.findByText('Ask AI is not available right now.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask' })).toBeNull();
  });

  it('shows a clear message and no answer when the model fails', async () => {
    stub({ ask: reply(503, { error: 'Ask AI is not available right now.' }) });
    show('?q=Can my landlord keep my deposit');
    const u = user();
    await u.click(await screen.findByRole('checkbox', { name: 'I understand' }));
    await u.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Ask AI is not available right now.')).toBeInTheDocument();
    expect(screen.queryByText('Short answer.')).toBeNull();
  });
});

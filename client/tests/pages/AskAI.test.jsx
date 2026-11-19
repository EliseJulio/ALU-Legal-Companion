import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    const ask = screen.getByRole('button', { name: 'Ask' });
    await u.click(ask);
    // Submitting the form straight away is what the browser does for Enter. Only the page's own check can stop it.
    fireEvent.submit(ask.closest('form'));
    await settle();
    expect(asks()).toHaveLength(0);
    await u.click(screen.getByRole('checkbox', { name: 'I understand' }));
    await u.click(screen.getByRole('button', { name: 'Ask' }));
    await settle();
    expect(asks()).toHaveLength(1);
  });

  it('lists the source guides and opens each one in a new tab, so the answer stays on the page', async () => {
    stub({ ask: reply(200, { answered: true, answer: 'Short answer.', sources: [{ id: 3, title: 'Getting your deposit back' }, { id: 5, title: 'Ending a lease' }] }) });
    show('?q=Can my landlord keep my deposit');
    const u = user();
    await u.click(await screen.findByRole('checkbox', { name: 'I understand' }));
    await u.click(screen.getByRole('button', { name: 'Ask' }));
    const list = await screen.findByRole('list', { name: 'Sources' });
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/guides/3');
    expect(links[1]).toHaveAttribute('href', '/guides/5');
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveTextContent('(opens in a new tab)');
    }
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

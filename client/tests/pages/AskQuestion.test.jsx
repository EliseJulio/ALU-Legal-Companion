import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AskQuestion from '@/pages/AskQuestion';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

function show(role = null) {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'a@example.org', role } });
  return render(
    <MemoryRouter initialEntries={['/ask']}>
      <AuthProvider>
        <Routes>
          <Route path="/ask" element={<AskQuestion />} />
          <Route path="/ask/check" element={<p>Check page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const u = () => userEvent.setup({ delay: null });
const call = () => global.fetch.mock.calls.at(-1);
const posted = () => global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST');
// Presses send. An anonymous question must be acknowledged first, so the box is ticked here when it
// is on the page. A test about the box itself does not use this.
const send = async (user) => {
  const box = screen.queryByRole('checkbox', { name: /code cannot be recovered/ });
  if (box && !box.checked) await user.click(box);
  await user.click(screen.getByRole('button', { name: 'Send my question' }));
};

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(reply(201, { id: 1, anon_token: '1234-5678-9ABC-DEFG' }));
});

describe('Ask a lawyer as a visitor', () => {
  it('says a person answers, that an answer is not guaranteed, and that it is not legal advice', () => {
    show();
    expect(screen.getByRole('heading', { level: 1, name: 'Ask a human legal expert' })).toBeInTheDocument();
    expect(screen.getByText(/human legal expert\. A response is not guaranteed\./)).toBeInTheDocument();
    expect(screen.getByText(/Legal information, not legal advice/)).toBeInTheDocument();
  });

  it('warns that the code is shown once and links to the urgent numbers', () => {
    show();
    expect(screen.getByText(/shown one time only/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the urgent numbers' })).toHaveAttribute('href', '/emergency');
    expect(screen.queryByRole('group', { name: /How do you want to send this/ })).not.toBeInTheDocument();
  });

  it('asks for the question first and sends nothing', async () => {
    show();
    await u().click(screen.getByRole('button', { name: 'Send my question' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write your question first.');
    expect(posted()).toHaveLength(0);
  });

  it('sends to the anonymous route without a login and shows the code', async () => {
    const user = u();
    show();
    await user.type(screen.getByLabelText('Your question'), '  Can my landlord keep my deposit? ');
    await send(user);
    expect(await screen.findByText('1234-5678-9ABC-DEFG')).toBeInTheDocument();
    const [url, options] = call();
    expect(String(url)).toMatch(/\/questions\/anonymous$/);
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(options.body)).toEqual({ text: 'Can my landlord keep my deposit?' });
    expect(screen.queryByLabelText('Your question')).not.toBeInTheDocument();
  });

  it('goes to the answer check once the code is saved', async () => {
    const user = u();
    show();
    await user.type(screen.getByLabelText('Your question'), 'A question');
    await send(user);
    await screen.findByText('1234-5678-9ABC-DEFG');
    await user.click(screen.getByLabelText(/I have saved my code/));
    await user.click(screen.getByRole('button', { name: 'Continue to check my request' }));
    expect(await screen.findByText('Check page')).toBeInTheDocument();
  });

  it('keeps the text and shows the message when the server refuses', async () => {
    global.fetch.mockResolvedValue(reply(429, { error: 'Too many attempts. Please wait.' }));
    const user = u();
    show();
    await user.type(screen.getByLabelText('Your question'), 'Keep this text');
    await send(user);
    expect(await screen.findByText('Too many attempts. Please wait.')).toBeInTheDocument();
    expect(screen.getByLabelText('Your question')).toHaveValue('Keep this text');
  });

  it('does not show a code that never came', async () => {
    global.fetch.mockResolvedValue(reply(201, { id: 1 }));
    const user = u();
    show();
    await user.type(screen.getByLabelText('Your question'), 'A question');
    await send(user);
    expect(await screen.findByText(/did not return a code/)).toBeInTheDocument();
  });

  it('links to the answer check', () => {
    show();
    expect(screen.getByRole('link', { name: 'Already asked? Check for your answer' })).toHaveAttribute('href', '/ask/check');
  });
});

describe("Ask a lawyer: the side panel", () => {
  it("says to share only what is needed and what the signed-in alternative is", () => {
    show();
    expect(screen.getByRole("heading", { name: "Only share what is needed" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Signed-in alternative" })).toBeInTheDocument();
    expect(screen.getByText(/Anonymous questions stay outside that account history/)).toBeInTheDocument();
  });

  it("ends the breadcrumb on this page", () => {
    show();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Home / Ask an expert");
  });
});

describe('Ask a lawyer as a student', () => {
  it('pre-selects nothing and keeps the button off until a choice is made', () => {
    show('student');
    expect(screen.getByRole('radio', { name: /With my name/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Without my name' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Send my question' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/Pick one of the two options above/)).toBeInTheDocument();
  });

  it('sends under the account when chosen and shows no code', async () => {
    global.fetch.mockResolvedValue(reply(201, { id: 9, status: 'open' }));
    const user = u();
    show('student');
    await user.type(screen.getByLabelText('Your question'), 'A question');
    await user.click(screen.getByRole('radio', { name: /With my name/ }));
    expect(screen.queryByText(/shown one time only/)).not.toBeInTheDocument();
    await send(user);
    expect(await screen.findByRole('link', { name: 'My activity' })).toHaveAttribute('href', '/my-activity');
    const [url, options] = call();
    expect(String(url)).toMatch(/\/questions$/);
    expect(options.headers.Authorization).toBe('Bearer tok-1');
  });

  it('sends to the anonymous route without the login when that is chosen', async () => {
    const user = u();
    show('staff');
    await user.type(screen.getByLabelText('Your question'), 'A question');
    await user.click(screen.getByRole('radio', { name: 'Without my name' }));
    await send(user);
    expect(await screen.findByText('1234-5678-9ABC-DEFG')).toBeInTheDocument();
    const [url, options] = call();
    expect(String(url)).toMatch(/\/questions\/anonymous$/);
    expect(options.headers).not.toHaveProperty('Authorization');
  });
});

describe('Ask an expert: saving the one-time code', () => {
  const box = () => screen.getByRole('checkbox', { name: 'I understand the code cannot be recovered.' });

  it('offers a visitor a way to sign in instead and a signed-in person none', () => {
    const { unmount } = show();
    expect(screen.getByRole('link', { name: 'Sign in instead' })).toHaveAttribute('href', '/login?next=%2Fask');
    unmount();
    show('student');
    expect(screen.queryByRole('link', { name: 'Sign in instead' })).not.toBeInTheDocument();
  });

  it('asks a visitor to promise to save the code and sends nothing until they do', async () => {
    const user = u();
    show();
    await user.type(screen.getByLabelText('Your question'), 'A question');
    await user.click(screen.getByRole('button', { name: 'Send my question' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Tick the box to say you understand the code cannot be recovered/);
    expect(posted()).toHaveLength(0);
    expect(box()).toHaveFocus();
    expect(box()).toHaveAttribute('aria-describedby', alert.id);
    expect(box()).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the question problem first and ties it to the question box', async () => {
    show();
    await u().click(screen.getByRole('button', { name: 'Send my question' }));
    const alert = screen.getByRole('alert');
    expect(screen.getByLabelText('Your question')).toHaveAttribute('aria-describedby', expect.stringContaining(alert.id));
    expect(screen.getByLabelText('Your question')).toHaveAttribute('aria-invalid', 'true');
  });

  it('puts the message in the page again when the same problem is met twice, so it is read again', async () => {
    const user = u();
    show();
    await user.click(screen.getByRole('button', { name: 'Send my question' }));
    const first = await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Send my question' }));
    expect(await screen.findByRole('alert')).not.toBe(first);
  });

  it('asks nothing of a person who sends under their own name, because there is no code', async () => {
    const user = u();
    show('student');
    await user.click(screen.getByRole('radio', { name: /With my name/ }));
    expect(screen.queryByRole('checkbox', { name: /cannot be recovered/ })).not.toBeInTheDocument();
  });

  it('takes the message about the box away when the box is no longer on the page', async () => {
    const user = u();
    show('student');
    await user.type(screen.getByLabelText('Your question'), 'A question');
    await user.click(screen.getByRole('radio', { name: 'Without my name' }));
    await user.click(screen.getByRole('button', { name: 'Send my question' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Tick the box/);
    await user.click(screen.getByRole('radio', { name: /With my name/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('moves focus to the confirmation so the one-time code is the first thing read', async () => {
    const user = u();
    show();
    await user.type(screen.getByLabelText('Your question'), 'A question');
    await send(user);
    const code = await screen.findByText('1234-5678-9ABC-DEFG');
    expect(code.closest('[tabindex="-1"]')).toHaveFocus();
  });

  it('asks again for the promise after the choice is changed away and back', async () => {
    const user = u();
    show('student');
    await user.click(screen.getByRole('radio', { name: 'Without my name' }));
    await user.click(box());
    expect(box()).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /With my name/ }));
    await user.click(screen.getByRole('radio', { name: 'Without my name' }));
    expect(box()).not.toBeChecked();
  });
});

describe('Ask a lawyer as an expert or admin', () => {
  it('is anonymous with no choice because the other route would refuse them', () => {
    show('admin');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send my question' })).not.toHaveAttribute('aria-disabled', 'true');
  });
});

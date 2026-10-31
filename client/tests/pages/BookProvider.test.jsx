import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BookProvider from '@/pages/BookProvider';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const FUTURE = '2099-01-01T10:00';

function show({ role = null, id = '5' } = {}) {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Student', email: 'a@example.org', role } });
  return render(
    <MemoryRouter initialEntries={[`/directory/book/${id}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/directory/book/:id" element={<BookProvider />} />
          <Route path="/directory/booking-check" element={<p>Check page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const PROVIDER = { id: 5, name: 'Example Pro Bono Lawyer', type: 'pro_bono_lawyer', bookable: true };
const TOKEN_REPLY = { id: 1, anon_token: '1234-5678-9ABC-DEFG' };
const posted = () => global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST');

const fillSlot = (value = FUTURE) => fireEvent.change(screen.getByLabelText('Date and time'), { target: { value } });
// Presses the send button. A request that will be anonymous must be acknowledged first, so the box is
// ticked here when it is on the page. A test about the box itself does not use this.
const send = async () => {
  const user = userEvent.setup({ delay: null });
  const box = screen.queryByRole('checkbox', { name: /save the code/ });
  if (box && !box.checked) await user.click(box);
  await user.click(screen.getByRole('button', { name: 'Send consultation request' }));
};
const call = () => global.fetch.mock.calls.at(-1);

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn(async (_url, options) => (options?.method === 'POST' ? reply(201, TOKEN_REPLY) : reply(200, PROVIDER)));
});

describe('Booking a lawyer as a visitor', () => {
  it('warns that the code is shown once before anything is sent', () => {
    show();
    expect(screen.getByText(/shown one time only/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /How do you want to send this/ })).not.toBeInTheDocument();
  });

  it('refuses a missing time without sending anything', async () => {
    show();
    await send();
    expect(await screen.findByText('Choose a date and time for the appointment.')).toBeInTheDocument();
    expect(posted()).toHaveLength(0);
  });

  it('refuses a time in the past without sending anything', async () => {
    show();
    fillSlot('2001-01-01T10:00');
    await send();
    expect(await screen.findByText('Choose a time in the future.')).toBeInTheDocument();
    expect(posted()).toHaveLength(0);
  });

  it('sends to the anonymous route without a login and shows the code', async () => {
    show();
    fillSlot();
    fireEvent.change(screen.getByLabelText(/What is it about/), { target: { value: '  My deposit  ' } });
    await send();
    expect(await screen.findByText('1234-5678-9ABC-DEFG')).toBeInTheDocument();
    const [url, options] = call();
    expect(String(url)).toMatch(/\/bookings\/anonymous$/);
    expect(options.headers).not.toHaveProperty('Authorization');
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({ provider_id: 5, topic: 'My deposit' });
    expect(body.slot).toBe(new Date(FUTURE).toISOString());
    expect(screen.queryByLabelText('Date and time')).not.toBeInTheDocument();
  });

  it('goes to the booking check once the code is saved', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    fillSlot();
    await send();
    await screen.findByText('1234-5678-9ABC-DEFG');
    await user.click(screen.getByLabelText(/I have saved my code/));
    await user.click(screen.getByRole('button', { name: 'Continue to check my request' }));
    expect(await screen.findByText('Check page')).toBeInTheDocument();
  });

  it('keeps what was typed and shows the message when the server refuses', async () => {
    global.fetch.mockResolvedValue(reply(400, { error: 'This provider does not take online bookings yet' }));
    show();
    fillSlot();
    fireEvent.change(screen.getByLabelText(/What is it about/), { target: { value: 'Keep this text' } });
    await send();
    expect(await screen.findByText('This provider does not take online bookings yet')).toBeInTheDocument();
    expect(screen.getByLabelText(/What is it about/)).toHaveValue('Keep this text');
  });

  it('does not show a code that never came', async () => {
    global.fetch.mockResolvedValue(reply(201, { id: 1 }));
    show();
    fillSlot();
    await send();
    expect(await screen.findByText(/did not return a code/)).toBeInTheDocument();
  });

  it('explains a booking link that is not a number', () => {
    show({ id: 'abc' });
    expect(screen.getByText('That booking link is not right')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the directory' })).toHaveAttribute('href', '/directory');
  });
});

describe('Booking a lawyer as a student', () => {
  it('pre-selects nothing and keeps the button off until a choice is made', () => {
    show({ role: 'student' });
    expect(screen.getByRole('radio', { name: /With my name/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Without my name' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Send consultation request' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/Pick one of the two options above/)).toBeInTheDocument();
  });

  it('sends under the account when chosen and shows no code', async () => {
    const user = userEvent.setup({ delay: null });
    global.fetch.mockResolvedValue(reply(201, { id: 9, status: 'requested' }));
    show({ role: 'student' });
    fillSlot();
    await user.click(screen.getByRole('radio', { name: /With my name/ }));
    expect(screen.queryByText(/shown one time only/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send consultation request' }));
    expect(await screen.findByRole('link', { name: 'My activity' })).toHaveAttribute('href', '/my-activity');
    // The person is told an email follows. The old line said nobody would write.
    expect(screen.getByText(/you will get an email with the time and the meeting link/)).toBeInTheDocument();
    expect(screen.queryByText(/Nobody will email you/)).not.toBeInTheDocument();
    const [url, options] = call();
    expect(String(url)).toMatch(/\/bookings$/);
    expect(options.headers.Authorization).toBe('Bearer tok-1');
  });

  it('sends to the anonymous route without the login when that is chosen', async () => {
    const user = userEvent.setup({ delay: null });
    show({ role: 'student' });
    fillSlot();
    await user.click(screen.getByRole('radio', { name: 'Without my name' }));
    expect(screen.getByText(/shown one time only/)).toBeInTheDocument();
    await send();
    await waitFor(() => expect(call()[1].method).toBe('POST'));
    const [url, options] = call();
    expect(String(url)).toMatch(/\/bookings\/anonymous$/);
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(await screen.findByText('1234-5678-9ABC-DEFG')).toBeInTheDocument();
  });
});

describe('Booking a lawyer: what is said about email', () => {
  it('promises nothing before a choice is made', () => {
    show({ role: 'student' });
    expect(screen.queryByText(/goes to the address of your account/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No email is sent/)).not.toBeInTheDocument();
  });

  it('says an email follows an acceptance when the person chooses their name', async () => {
    const user = userEvent.setup({ delay: null });
    show({ role: 'student' });
    await user.click(screen.getByRole('radio', { name: /With my name/ }));
    expect(screen.getByText(/an email with the time and the meeting link goes to the address of your account/)).toBeInTheDocument();
    expect(screen.queryByText(/No email is sent/)).not.toBeInTheDocument();
  });

  it('says no email is sent when the person chooses to stay anonymous', async () => {
    const user = userEvent.setup({ delay: null });
    show({ role: 'student' });
    await user.click(screen.getByRole('radio', { name: 'Without my name' }));
    expect(screen.getByText(/No email is sent, because there is no address/)).toBeInTheDocument();
    expect(screen.queryByText(/goes to the address of your account/)).not.toBeInTheDocument();
  });

  it('does not promise a visitor an email', () => {
    show();
    expect(screen.queryByText(/goes to the address of your account/)).not.toBeInTheDocument();
    expect(screen.queryByText(/you will get an email/)).not.toBeInTheDocument();
  });
});

describe('Request consultation: what the page says and offers', () => {
  it('has the heading of the design and names the provider with the promise that it is not an appointment', async () => {
    show();
    expect(screen.getByRole('heading', { level: 1, name: 'Request a consultation' })).toBeInTheDocument();
    expect(await screen.findByText('Example Pro Bono Lawyer · A request is not a confirmed appointment.')).toBeInTheDocument();
    expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/directory\/providers\/5$/);
  });

  it('still makes the promise when the name cannot be loaded', async () => {
    global.fetch = vi.fn(async () => reply(404, { error: 'That listing is not in the directory' }));
    show();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText('A request is not a confirmed appointment.')).toBeInTheDocument();
  });

  it('offers a visitor a way to sign in instead and a signed-in person none', () => {
    const { unmount } = show();
    expect(screen.getByRole('link', { name: 'Sign in instead' })).toHaveAttribute('href', '/login?next=%2Fdirectory%2Fbook%2F5');
    unmount();
    show({ role: 'student' });
    expect(screen.queryByRole('link', { name: 'Sign in instead' })).not.toBeInTheDocument();
  });

  it('makes the send and cancel buttons the width of the screen on a phone', () => {
    show();
    expect(screen.getByRole('button', { name: 'Send consultation request' })).toHaveClass('w-full', 'sm:w-auto');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveClass('w-full', 'sm:w-auto');
  });

  it('can be cancelled and leads on to the booking check', () => {
    show();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/directory');
    expect(screen.getByRole('link', { name: 'Already requested? Check with your code' })).toHaveAttribute('href', '/directory/booking-check');
  });
});

describe('Request consultation: saving the one-time code', () => {
  it('asks a visitor to promise to save the code and sends nothing until they do', async () => {
    show();
    fillSlot();
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: 'Send consultation request' }));
    expect(await screen.findByText(/Tick the box to say you will save the code/)).toBeInTheDocument();
    expect(posted()).toHaveLength(0);
    expect(screen.getByRole('checkbox', { name: 'I understand that I must save the code before leaving.' })).toHaveFocus();
  });

  it('sends once the promise is made', async () => {
    show();
    fillSlot();
    await send();
    expect(await screen.findByText('1234-5678-9ABC-DEFG')).toBeInTheDocument();
    expect(posted()).toHaveLength(1);
  });

  it('ties the message to the box, so a screen reader reads why it stopped', async () => {
    show();
    fillSlot();
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: 'Send consultation request' }));
    const alert = await screen.findByRole('alert');
    const box = screen.getByRole('checkbox', { name: /save the code/ });
    expect(box).toHaveAttribute('aria-describedby', alert.id);
    expect(box).toHaveAttribute('aria-invalid', 'true');
  });

  it('ties a missing time to the time field the same way', async () => {
    show();
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: 'Send consultation request' }));
    const alert = await screen.findByRole('alert');
    expect(screen.getByLabelText('Date and time')).toHaveAttribute('aria-describedby', expect.stringContaining(alert.id));
    expect(screen.getByLabelText('Date and time')).toHaveAttribute('aria-invalid', 'true');
  });

  it('puts the message in the page again when the same problem is met twice, so it is read again', async () => {
    show();
    fillSlot();
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: 'Send consultation request' }));
    const first = await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Send consultation request' }));
    const second = await screen.findByRole('alert');
    expect(second).not.toBe(first);
  });

  it('takes the message about the box away when the box is no longer on the page', async () => {
    show({ role: 'student' });
    fillSlot();
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('radio', { name: 'Without my name' }));
    await user.click(screen.getByRole('button', { name: 'Send consultation request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Tick the box/);
    await user.click(screen.getByRole('radio', { name: /With my name/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('moves focus to the confirmation so the one-time code is the first thing read', async () => {
    show();
    fillSlot();
    await send();
    const code = await screen.findByText('1234-5678-9ABC-DEFG');
    expect(code.closest('[tabindex="-1"]')).toHaveFocus();
  });

  it('asks again for the promise after the choice is changed away and back', async () => {
    show({ role: 'student' });
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('radio', { name: 'Without my name' }));
    await user.click(screen.getByRole('checkbox', { name: /save the code/ }));
    expect(screen.getByRole('checkbox', { name: /save the code/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /With my name/ }));
    await user.click(screen.getByRole('radio', { name: 'Without my name' }));
    expect(screen.getByRole('checkbox', { name: /save the code/ })).not.toBeChecked();
  });

  it('asks nothing of a person who sends under their own name, because there is no code', async () => {
    show({ role: 'student' });
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('radio', { name: /With my name/ }));
    expect(screen.queryByRole('checkbox', { name: /save the code/ })).not.toBeInTheDocument();
  });

  it('asks a signed-in person to promise only when they choose to stay anonymous', async () => {
    show({ role: 'student' });
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('radio', { name: 'Without my name' }));
    expect(screen.getByRole('checkbox', { name: 'I understand that I must save the code before leaving.' })).toBeInTheDocument();
  });
});

describe('Booking a lawyer as an expert or admin', () => {
  it('is anonymous with no choice because the other route would refuse them', () => {
    show({ role: 'admin' });
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send consultation request' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it("shows what happens next and a breadcrumb", async () => {
    show();
    expect(screen.getByRole("heading", { name: "What happens next" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Home / Directory / Request consultation");
    expect(await screen.findByText(/A request is not a confirmed appointment\./)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import JoinCall from '@/pages/JoinCall';
import { apiPost } from '@/lib/api';
import { useOptionalUser } from '@/lib/AuthContext';

vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal()), apiPost: vi.fn() }));
vi.mock('@/lib/AuthContext', () => ({ useOptionalUser: vi.fn() }));
// The call screen has its own tests. Here it is a stand-in that shows what it was given.
vi.mock('@/components/CallRoom', () => ({
  default: ({ reply, onLeft }) => (
    <div data-testid="call-room" data-role={reply.role}>
      <button type="button" onClick={onLeft}>leave</button>
    </div>
  ),
}));

const CODE = 'abcd-abcd-abcd-abcd';
const OWN = { provider: 'own', role: 'guest', ticket: 'ticket-1', room: 'room', signal_url: 'wss://signal.example.invalid', ice_servers: [] };
const user = () => userEvent.setup({ delay: null });

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function show(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/join/7', state }]}>
      <Routes>
        <Route path="/join/:id" element={<JoinCall />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const join = () => user().click(screen.getByRole('button', { name: 'Join the call' }));

beforeEach(() => {
  vi.clearAllMocks();
  useOptionalUser.mockReturnValue(null);
  apiPost.mockResolvedValue(OWN);
});

describe('before joining', () => {
  it('starts nothing until Join is pressed', () => {
    show({ code: CODE });
    expect(apiPost).not.toHaveBeenCalled();
    expect(screen.getByText(/starts only when you press Join/)).toBeInTheDocument();
  });

  it('asks an anonymous booker for the booking code', () => {
    show();
    expect(screen.getByLabelText('Your booking code')).toBeInTheDocument();
  });
});

describe('joining', () => {
  it('sends the booking code in the body and no login when anonymous', async () => {
    show({ code: CODE });
    await join();
    expect(apiPost).toHaveBeenCalledWith('/bookings/7/join', { audio_only: false, anon_token: CODE }, { anonymous: true });
  });

  it('sends no code when signed in', async () => {
    useOptionalUser.mockReturnValue({ role: 'student' });
    show({ code: CODE });
    await join();
    expect(apiPost).toHaveBeenCalledWith('/bookings/7/join', { audio_only: false }, { anonymous: false });
  });

  it('shows the call screen for a call held inside the platform', async () => {
    useOptionalUser.mockReturnValue({ role: 'student' });
    show();
    await join();
    expect(await screen.findByTestId('call-room')).toHaveAttribute('data-role', 'guest');
    expect(screen.queryByRole('button', { name: 'Join the call' })).toBeNull();
  });

  it.each([
    ['a student', { role: 'student' }, '/my-activity'],
    ['a lawyer', { role: 'legal_expert' }, '/expert/calendar'],
  ])('sends %s to %s after they leave', async (_who, person, path) => {
    useOptionalUser.mockReturnValue(person);
    show();
    await join();
    await user().click(await screen.findByRole('button', { name: 'leave' }));
    expect(screen.getByTestId('where')).toHaveTextContent(path);
  });

  it('shows an error and stays on the page when the join is refused', async () => {
    apiPost.mockRejectedValue(Object.assign(new Error('That booking code is not right.'), { status: 404 }));
    show({ code: CODE });
    await join();
    expect(await screen.findByRole('alert')).toHaveTextContent(/not right/);
    expect(screen.queryByTestId('call-room')).toBeNull();
  });
});

describe('the fallback rooms', () => {
  it('offers the Meet link when it is https', async () => {
    apiPost.mockResolvedValue({ provider: 'meet', url: 'https://meet.google.com/abc-defg-hij' });
    show({ code: CODE });
    await join();
    expect(await screen.findByRole('link', { name: /Open Google Meet/ })).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
  });

  it('frames a video room only on a daily.co address', async () => {
    apiPost.mockResolvedValue({ provider: 'daily', url: 'https://evil.example/room', token: 'tok' });
    show({ code: CODE });
    await join();
    expect(await screen.findByText('The call could not be opened. Try again in a moment.')).toBeInTheDocument();
    expect(screen.queryByTitle('Video consultation')).toBeNull();
  });
});

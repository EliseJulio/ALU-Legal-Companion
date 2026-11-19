import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsultationHours from '@/components/ConsultationHours';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const KEYS = { slot_minutes: 30, timezone: 'Africa/Kigali' };
const MONDAY_MORNING = { weekday: 1, start: '09:00', end: '12:00' };
const STANDARD = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '09:00', end: '17:00' }));

const EXPLAIN = 'Students can book only inside these hours. Each consultation is 30 minutes. Times are in Kigali time.';

function show({ availability, onSaved = vi.fn() } = {}) {
  render(<ConsultationHours availability={availability} onSaved={onSaved} />);
  return { onSaved };
}
const puts = () => global.fetch.mock.calls.filter(([, o]) => o?.method === 'PUT');
const putBody = () => JSON.parse(puts()[0][1].body);

beforeEach(() => {
  global.fetch = vi.fn(async (_url, options = {}) => (
    options.method === 'PUT'
      ? reply(200, { ...KEYS, is_default: false, windows: JSON.parse(options.body).windows })
      : reply(404, {})
  ));
});

describe('Your consultation hours: the card', () => {
  it('has a heading, says in plain words what the hours are for, labels each time, and sizes its buttons to touch', () => {
    show({ availability: { ...KEYS, is_default: false, windows: [MONDAY_MORNING] } });
    expect(screen.getByRole('heading', { name: 'Your consultation hours' })).toBeInTheDocument();
    expect(screen.getByText(EXPLAIN)).toBeInTheDocument();
    const start = screen.getByLabelText('Start on Monday, window 1');
    expect(start).toHaveValue('09:00');
    expect(within(start).getByRole('option', { name: '09:30' })).toBeInTheDocument();
    expect(screen.getByLabelText('End on Monday, window 1')).toHaveValue('12:00');
    expect(screen.getByRole('button', { name: 'Add hours on Tuesday' })).toHaveClass('min-h-touch');
    expect(screen.getByRole('button', { name: 'Remove window 1 on Monday' })).toHaveClass('min-h-touch');
    expect(screen.getByRole('button', { name: 'Save consultation hours' })).toHaveClass('min-h-touch');
  });
});

describe('Your consultation hours: hours that arrive after the card is first drawn', () => {
  it('shows the standard hours and saves them whole when the answer comes after the first draw', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<ConsultationHours loading onSaved={vi.fn()} />);
    expect(screen.getByText('Loading your hours…')).toBeInTheDocument();
    rerender(<ConsultationHours availability={{ ...KEYS, is_default: true, windows: STANDARD }} onSaved={vi.fn()} />);
    expect(screen.queryByText(/You have no open hours/)).toBeNull();
    expect(screen.getByLabelText('Start on Monday, window 1')).toHaveValue('09:00');
    await user.click(screen.getByRole('button', { name: 'Save consultation hours' }));
    expect(putBody().windows).toHaveLength(5);
  });
});

describe('Your consultation hours: the standard hours before the lawyer has saved', () => {
  it('says they are standard, shows Monday to Friday nine to five, and keeps them as the lawyer’s own when saved unchanged', async () => {
    const user = userEvent.setup({ delay: null });
    const { onSaved } = show({ availability: { ...KEYS, is_default: true, windows: STANDARD } });
    expect(screen.getByText('These are the standard hours. Students can already book inside them. Change them and save, or save to keep them.')).toBeInTheDocument();
    expect(screen.getByLabelText('Start on Friday, window 1')).toHaveValue('09:00');
    expect(screen.getByLabelText('End on Friday, window 1')).toHaveValue('17:00');
    expect(screen.queryByLabelText(/on Saturday/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save consultation hours' }));
    expect(putBody().windows).toHaveLength(5);
    expect(await screen.findByText('Saved. Students can book only inside these hours.')).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ is_default: false }));
  });
});

describe('Your consultation hours: a lawyer who has closed bookings', () => {
  it('says nobody can book until hours are added, and saves an empty list as a deliberate closure', async () => {
    const user = userEvent.setup({ delay: null });
    show({ availability: { ...KEYS, is_default: false, windows: [] } });
    expect(screen.getByText('You have no open hours. Nobody can book you until you add hours.')).toBeInTheDocument();
    expect(screen.queryByText(/These are the standard hours/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save consultation hours' }));
    expect(putBody()).toEqual({ windows: [] });
    expect(await screen.findByText('You have no open hours. Nobody can book you until you add hours.')).toBeInTheDocument();
  });
});

describe('Your consultation hours: adding, removing and saving', () => {
  it('adds nine-to-twelve on the day asked, removes only the window asked, and saves the whole set in day order', async () => {
    const user = userEvent.setup({ delay: null });
    show({ availability: { ...KEYS, is_default: false, windows: [MONDAY_MORNING, { weekday: 1, start: '14:00', end: '15:00' }, { weekday: 3, start: '13:00', end: '14:00' }] } });
    await user.click(screen.getByRole('button', { name: 'Remove window 1 on Monday' }));
    expect(screen.getByLabelText('Start on Monday, window 1')).toHaveValue('14:00');
    expect(screen.getByLabelText('Start on Wednesday, window 1')).toHaveValue('13:00');
    expect(screen.queryByLabelText('Start on Monday, window 2')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add hours on Monday' }));
    expect(screen.getByLabelText('Start on Monday, window 2')).toHaveValue('09:00');
    expect(screen.getByLabelText('End on Monday, window 2')).toHaveValue('12:00');
    await user.click(screen.getByRole('button', { name: 'Save consultation hours' }));
    const [url, options] = puts()[0];
    expect(String(url)).toMatch(/\/bookings\/availability$/);
    expect(options.method).toBe('PUT');
    expect(putBody()).toEqual({ windows: [
      { weekday: 1, start: '09:00', end: '12:00' },
      { weekday: 1, start: '14:00', end: '15:00' },
      { weekday: 3, start: '13:00', end: '14:00' },
    ] });
  });

  it('refuses an overlap without sending anything, and keeps the rows when the server refuses a save', async () => {
    const user = userEvent.setup({ delay: null });
    show({ availability: { ...KEYS, is_default: false, windows: [MONDAY_MORNING, { weekday: 1, start: '11:00', end: '13:00' }] } });
    await user.click(screen.getByRole('button', { name: 'Save consultation hours' }));
    expect(await screen.findByText('Two windows on Monday overlap. Change one of them.')).toBeInTheDocument();
    expect(puts()).toHaveLength(0);
    global.fetch = vi.fn(async () => reply(400, { error: 'Each window must start on the half hour.' }));
    cleanup();
    show({ availability: { ...KEYS, is_default: false, windows: [MONDAY_MORNING] } });
    await user.click(screen.getByRole('button', { name: 'Save consultation hours' }));
    expect(await screen.findByText('Each window must start on the half hour.')).toBeInTheDocument();
    expect(screen.getByLabelText('Start on Monday, window 1')).toHaveValue('09:00');
  });
});

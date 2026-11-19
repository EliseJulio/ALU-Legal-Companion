import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsultationHours from '@/components/ConsultationHours';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

// A Thursday in Kigali. The fixed clock is before it, so no slot that day is past.
const THURSDAY = '2026-11-19';
const NOW = new Date(Date.UTC(2026, 10, 4, 6, 0));
const KEYS = { slot_minutes: 30, timezone: 'Africa/Kigali' };
const STANDARD = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '09:00', end: '17:00' }));
const THU_MORNING = { weekday: 4, start: '09:00', end: '10:00' };

// The slots of the Thursday, drawn the way the calendar draws them. The children render prop is the same one
// the Expert calendar uses, so these tests run the real container and the real slot block.
function show({ availability, loading, error, items = [], onSaved = vi.fn(), phoneSelect, phone = false } = {}) {
  const view = (props) => (
    <ConsultationHours {...props} onSaved={onSaved} items={items} now={NOW}>
      {({ dayExtra }) => (
        <div>
          {dayExtra?.(THURSDAY, { select: phoneSelect ?? vi.fn(), phone })}
        </div>
      )}
    </ConsultationHours>
  );
  const utils = render(view({ availability, loading, error }));
  return { ...utils, rerenderWith: (props) => utils.rerender(view(props)), onSaved };
}

const puts = () => global.fetch.mock.calls.filter(([, o]) => o?.method === 'PUT');
const putBody = () => JSON.parse(puts()[0][1].body);
const slot = (label) => screen.getByRole('button', { name: label });

beforeEach(() => {
  global.fetch = vi.fn(async (_url, options = {}) => (
    options.method === 'PUT'
      ? reply(200, { ...KEYS, is_default: false, windows: JSON.parse(options.body).windows })
      : reply(404, {})
  ));
});

describe('the draft is not built until the hours arrive', () => {
  it('shows no slots and no Save button while loading, so an empty list cannot be sent', () => {
    const { rerenderWith } = show({ loading: true });
    expect(screen.getByText('Loading your hours…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save hours' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Thursday 09:00/ })).not.toBeInTheDocument();
    rerenderWith({ availability: { ...KEYS, is_default: true, windows: STANDARD } });
    expect(screen.getByRole('button', { name: 'Thursday 09:00 to 09:30, open' })).toHaveAttribute('aria-pressed', 'true');
    expect(puts()).toHaveLength(0);
  });
});

describe('the standard hours', () => {
  it('says they are the standard hours until the lawyer saves, and keeps them when saved unchanged', async () => {
    const user = userEvent.setup({ delay: null });
    const { onSaved } = show({ availability: { ...KEYS, is_default: true, windows: STANDARD } });
    expect(screen.getByText('These are the standard hours. Students can already book inside them. Change them and save, or save to keep them.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save hours' }));
    expect(putBody().windows).toHaveLength(5);
    expect(await screen.findByText('Saved. Students can book only inside these hours.')).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ is_default: false }));
  });
});

describe('toggling slots', () => {
  it('closes an open slot in the draft, counts the change, and Discard restores it', async () => {
    const user = userEvent.setup({ delay: null });
    show({ availability: { ...KEYS, is_default: false, windows: [THU_MORNING] } });
    const nine = slot('Thursday 09:00 to 09:30, open');
    expect(nine).toHaveAttribute('aria-pressed', 'true');
    await user.click(nine);
    expect(slot('Thursday 09:00 to 09:30, closed')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('Not saved yet. 1 change.');
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(slot('Thursday 09:00 to 09:30, open')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Save hours' })).not.toBeInTheDocument();
  });

  it('sends the merged windows when the lawyer opens the slot after the last one', async () => {
    const user = userEvent.setup({ delay: null });
    show({ availability: { ...KEYS, is_default: false, windows: [THU_MORNING] } });
    await user.click(slot('Thursday 10:00 to 10:30, closed'));
    expect(screen.getByRole('status')).toHaveTextContent('Not saved yet. 1 change.');
    await user.click(screen.getByRole('button', { name: 'Save hours' }));
    expect(puts()).toHaveLength(1);
    expect(putBody()).toEqual({ windows: [{ weekday: 4, start: '09:00', end: '10:30' }] });
    expect(await screen.findByText('Saved. Students can book only inside these hours.')).toBeInTheDocument();
  });

  it('keeps the draft and shows the server words when a save is refused', async () => {
    const user = userEvent.setup({ delay: null });
    global.fetch = vi.fn(async () => reply(400, { error: 'Each window must start on the half hour.' }));
    show({ availability: { ...KEYS, is_default: false, windows: [THU_MORNING] } });
    await user.click(slot('Thursday 09:00 to 09:30, open'));
    await user.click(screen.getByRole('button', { name: 'Save hours' }));
    expect(await screen.findByText('Each window must start on the half hour.')).toBeInTheDocument();
    expect(slot('Thursday 09:00 to 09:30, closed')).toHaveAttribute('aria-pressed', 'false');
  });

  it('refuses more than fourteen windows and sends nothing', async () => {
    const user = userEvent.setup({ delay: null });
    const fourteen = Array.from({ length: 14 }, (_, i) => ({ weekday: 4, start: `${String(6 + i).padStart(2, '0')}:00`, end: `${String(6 + i).padStart(2, '0')}:30` }));
    show({ availability: { ...KEYS, is_default: false, windows: fourteen } });
    await user.click(slot('Thursday 20:00 to 20:30, closed'));
    await user.click(screen.getByRole('button', { name: 'Save hours' }));
    expect(await screen.findByText('You can add at most 14 windows.')).toBeInTheDocument();
    expect(puts()).toHaveLength(0);
  });
});

describe('closed bookings', () => {
  it('says nothing is open, and saving an empty list still closes bookings on purpose', async () => {
    const user = userEvent.setup({ delay: null });
    show({ availability: { ...KEYS, is_default: false, windows: [THU_MORNING] } });
    await user.click(slot('Thursday 09:00 to 09:30, open'));
    await user.click(slot('Thursday 09:30 to 10:00, open'));
    expect(screen.getByText('Nothing is open. Students cannot book you until you open some slots.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save hours' }));
    expect(putBody()).toEqual({ windows: [] });
    expect(await screen.findByText('Saved. Nobody can book you until you add hours.')).toBeInTheDocument();
  });
});

describe('a booked or requested slot', () => {
  const items = [
    { key: 'consult-1', id: 1, kind: 'consult', date: THURSDAY, time: '14:00', status: 'accepted', title: 'A lease', sub: '' },
    { key: 'consult-2', id: 2, kind: 'consult', date: THURSDAY, time: '15:00', status: 'requested', title: 'A deposit', sub: '' },
  ];

  it('is a button that is not a toggle, and it does not change the draft', async () => {
    const user = userEvent.setup({ delay: null });
    show({ availability: { ...KEYS, is_default: false, windows: [{ weekday: 4, start: '13:00', end: '16:00' }] }, items });
    const booked = slot('Thursday 14:00 to 14:30, booked. Go to the consultation.');
    expect(booked).not.toHaveAttribute('aria-pressed');
    const requested = slot('Thursday 15:00 to 15:30, requested. Go to the consultation.');
    expect(requested).not.toHaveAttribute('aria-pressed');
    await user.click(booked);
    expect(screen.queryByRole('button', { name: 'Save hours' })).not.toBeInTheDocument();
  });
});

describe('quick actions and the phone day stepper', () => {
  it('opens 09:00 to 17:00 on the day, and closes the whole day', async () => {
    const user = userEvent.setup({ delay: null });
    show({ availability: { ...KEYS, is_default: false, windows: [] } });
    const block = screen.getByRole('region', { name: 'Thursday 19 November: your slots' });
    await user.click(within(block).getByRole('button', { name: 'Open 09:00 to 17:00' }));
    expect(within(block).getByRole('status')).toHaveTextContent('Not saved yet. 16 changes.');
    await user.click(within(block).getByRole('button', { name: 'Close the whole day' }));
    expect(within(block).queryByRole('status')).toHaveTextContent('');
  });

  it('shows Previous day and Next day on a phone and moves the selected day', async () => {
    const user = userEvent.setup({ delay: null });
    const select = vi.fn();
    show({ availability: { ...KEYS, is_default: false, windows: [] }, phoneSelect: select, phone: true });
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    expect(select).toHaveBeenCalledWith('2026-11-20');
    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(select).toHaveBeenLastCalledWith('2026-11-18');
  });
});

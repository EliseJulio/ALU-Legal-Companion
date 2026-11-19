import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChangeTime from '@/components/ChangeTime';
import { ApiError } from '@/lib/api';

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body });

// 08:00 UTC is 10:00 in Kigali. 13:00 UTC is 15:00.
const TEN = '2026-11-12T08:00:00.000Z';
const THREE = '2026-11-12T13:00:00.000Z';

function show(onPick = vi.fn().mockResolvedValue(undefined)) {
  render(<ChangeTime providerId={7} primaryLabel="Move to this time" onPick={onPick} onNeverMind={vi.fn()} />);
  return onPick;
}

beforeEach(() => {
  global.fetch = vi.fn(async () => reply(200, { days: [{ date: '2026-11-12', slots: [THREE, TEN] }] }));
});

describe('Change the time', () => {
  it('loads the open times of the provider, shows them in Kigali time and sends the one picked', async () => {
    const user = userEvent.setup({ delay: null });
    const onPick = show();
    expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/bookings\/slots\/7$/);
    expect(await screen.findByText('Times are in Kigali time (UTC+2).')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '10:00' }));
    await user.click(screen.getByRole('button', { name: 'Move to this time' }));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(TEN));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('after a 409 refusal, loads the open times again and clears the chosen time', async () => {
    const user = userEvent.setup({ delay: null });
    const refused = new ApiError(409, 'That time is no longer open.');
    const onPick = show(vi.fn().mockRejectedValue(refused));
    await user.click(await screen.findByRole('button', { name: '10:00' }));
    await user.click(screen.getByRole('button', { name: 'Move to this time' }));
    expect(await screen.findByText('That time is no longer open.')).toBeInTheDocument();
    expect(onPick).toHaveBeenCalledWith(TEN);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(String(global.fetch.mock.calls[1][0])).toMatch(/\/bookings\/slots\/7$/);
    expect(screen.getByRole('button', { name: '10:00' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Move to this time' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('takes focus when it opens', async () => {
    show();
    expect(screen.getByRole('group', { name: 'Choose another time' })).toHaveFocus();
  });

  it('says so when the provider has no open time in the next two weeks', async () => {
    global.fetch = vi.fn(async () => reply(200, { days: [] }));
    show();
    expect(await screen.findByText('No open times in the next two weeks.')).toBeInTheDocument();
  });
});

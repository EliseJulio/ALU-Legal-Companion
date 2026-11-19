import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CancelConsultation from '@/components/CancelConsultation';

const WHEN = 'Friday 6 November at 10:00';

function show(onCancel = vi.fn().mockResolvedValue({ status: 'cancelled' }), onDone = vi.fn()) {
  render(<CancelConsultation when={WHEN} onCancel={onCancel} onDone={onDone} />);
  return { onCancel, onDone };
}

describe('Cancel this consultation', () => {
  it('asks inline at touch-target size, never opens a browser dialog, and Keep it cancels nothing', async () => {
    const dialog = vi.spyOn(window, 'confirm');
    const user = userEvent.setup({ delay: null });
    const { onCancel } = show();
    expect(screen.getByRole('button', { name: 'Cancel this consultation' })).toHaveClass('min-h-touch');
    await user.click(screen.getByRole('button', { name: 'Cancel this consultation' }));
    expect(screen.getByText(`Cancel the consultation for ${WHEN}?`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes, cancel it' })).toHaveClass('min-h-touch');
    expect(screen.getByRole('button', { name: 'Keep it' })).toHaveClass('min-h-touch');
    expect(onCancel).not.toHaveBeenCalled();
    expect(dialog).not.toHaveBeenCalled();
    dialog.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('button', { name: 'Yes, cancel it' })).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('moves focus to Keep it when the question opens, and back to the cancel button when Keep it is pressed', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    await user.click(screen.getByRole('button', { name: 'Cancel this consultation' }));
    expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByRole('button', { name: 'Cancel this consultation' })).toHaveFocus();
  });

  it('cancels once on confirm, then tells the page to refresh', async () => {
    const user = userEvent.setup({ delay: null });
    const { onCancel, onDone } = show();
    await user.click(screen.getByRole('button', { name: 'Cancel this consultation' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Cancelled.')).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows the server message when the cancel is refused and keeps the booking on the page', async () => {
    const user = userEvent.setup({ delay: null });
    const onCancel = vi.fn().mockRejectedValue(new Error('This consultation has already ended.'));
    const { onDone } = show(onCancel);
    await user.click(screen.getByRole('button', { name: 'Cancel this consultation' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    expect(await screen.findByText('This consultation has already ended.')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TokenDisplay from '@/components/TokenDisplay';

// The anonymous code is shown once. The person must say they saved it before moving on.
describe('TokenDisplay', () => {
  const show = (onContinue = vi.fn()) => {
    render(<TokenDisplay token="1234-5678-9ABC-DEFG" purpose="check your booking" onContinue={onContinue} />);
    return onContinue;
  };

  it('shows the code and says it cannot be recovered', () => {
    show();
    expect(screen.getByText('1234-5678-9ABC-DEFG')).toBeInTheDocument();
    expect(screen.getByText(/shown once and cannot be recovered/)).toBeInTheDocument();
  });

  it('keeps Continue off until the person says the code is saved', async () => {
    const user = userEvent.setup({ delay: null });
    const onContinue = show();
    const button = screen.getByRole('button', { name: 'Continue to check my request' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByLabelText(/I have saved my code/));
    await user.click(button);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('tells the person what to do when copying is blocked', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Copying is blocked/);
  });
});

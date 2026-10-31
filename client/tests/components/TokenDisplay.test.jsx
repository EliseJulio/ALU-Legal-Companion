import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TokenDisplay from '@/components/TokenDisplay';
import MeetLink from '@/components/MeetLink';

describe('TokenDisplay', () => {
  const show = (onContinue = vi.fn()) => {
    render(<TokenDisplay token="1234-5678-9ABC-DEFG" purpose="check your booking" onContinue={onContinue} />);
    return onContinue;
  };

  it('shows the code and says it cannot be recovered', () => {
    show();
    expect(screen.getByText('1234-5678-9ABC-DEFG')).toBeInTheDocument();
    expect(screen.getByText(/shown once and cannot be recovered/)).toBeInTheDocument();
    expect(screen.getByText(/the only way to check your booking/)).toBeInTheDocument();
  });

  it('keeps Continue off until the reader says the code is saved', async () => {
    const user = userEvent.setup({ delay: null });
    const onContinue = show();
    const button = screen.getByRole('button', { name: 'Continue to check my request' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/Tick the box above to continue/)).toBeInTheDocument();
    await user.click(screen.getByLabelText(/I have saved my code/));
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('tells the reader what to do when copying is blocked', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Copying is blocked/);
  });

  it('confirms when the copy worked', async () => {
    const user = userEvent.setup({ delay: null });
    show();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue() }, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(screen.getByRole('status')).toHaveTextContent('Copied to your clipboard.');
  });
});

describe('MeetLink', () => {
  it('shows nothing until the lawyer has accepted', () => {
    for (const status of ['requested', 'declined', 'completed']) {
      const { container, unmount } = render(<MeetLink booking={{ status, meet_link: 'https://meet.example.org/abc' }} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it('gives a way to join an accepted booking', () => {
    render(<MeetLink booking={{ status: 'accepted', meet_link: 'https://meet.example.org/abc' }} />);
    const link = screen.getByRole('link', { name: /Join the video call/ });
    expect(link).toHaveAttribute('href', 'https://meet.example.org/abc');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('never makes a link from an address that is not https', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'http://meet.example.org/abc', 'not a url']) {
      const { unmount } = render(<MeetLink booking={{ status: 'accepted', meet_link: bad }} />);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText(/No video room has been set up/)).toBeInTheDocument();
      unmount();
    }
  });

  it('says so when it is accepted and there is no room', () => {
    render(<MeetLink booking={{ status: 'accepted', meet_link: null }} />);
    expect(screen.getByText(/No video room has been set up/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

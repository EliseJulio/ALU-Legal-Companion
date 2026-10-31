import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MeetLink from '@/components/MeetLink';

describe('MeetLink', () => {
  it('shows nothing until the booking is accepted', () => {
    const { container } = render(<MeetLink booking={{ status: 'requested', meet_link: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a Join consultation button that is off, with the reason, when no room is set', () => {
    render(<MeetLink booking={{ status: 'accepted', meet_link: null }} />);
    const button = screen.getByRole('button', { name: 'Join consultation' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(/lawyer has not added a meeting link/);
  });

  it('links to the room when there is one', () => {
    render(<MeetLink booking={{ status: 'accepted', meet_link: 'https://meet.google.com/abc-defg-hij' }} />);
    expect(screen.getByRole('link', { name: /Join the video call/ })).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
    expect(screen.queryByRole('button', { name: 'Join consultation' })).toBeNull();
  });
});

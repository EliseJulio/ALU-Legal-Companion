import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// A busy button must keep keyboard focus and must not send its click. The guard is installed
// once for every test in tests/setup.js, as main.jsx does for the app.
describe('a button that is aria-disabled', () => {
  it('keeps focus and does not run its click', async () => {
    const onClick = vi.fn();
    render(<button type="button" aria-disabled="true" onClick={onClick}>Save</button>);
    const button = screen.getByRole('button', { name: 'Save' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it('does not submit its form when Enter is pressed in a field', async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <label>Name<input /></label>
        <button type="submit" aria-disabled="true">Send</button>
      </form>,
    );
    await userEvent.type(screen.getByLabelText('Name'), 'a{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('runs the click again once it is no longer aria-disabled', async () => {
    const onClick = vi.fn();
    render(<button type="button" onClick={onClick}>Save</button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordField from '@/components/PasswordField';

function Harness(props) {
  const [value, setValue] = useState('');
  return <PasswordField id="pw" label="Password" value={value} onChange={(e) => setValue(e.target.value)} {...props} />;
}

// Two boxes with one toggle under the last one, as on the reset page.
function Pair() {
  const [shown, setShown] = useState(false);
  return (
    <>
      <PasswordField id="one" label="New password" value="" onChange={() => {}} shown={shown} toggle={false} />
      <PasswordField id="two" label="Type it again" value="" onChange={() => {}} shown={shown} onShownChange={setShown} />
    </>
  );
}

describe('PasswordField', () => {
  it('hides the password at first and keeps the label tied to the box', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('shows and hides the password with one toggle that keeps its name', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Password'), 'secret words');
    const toggle = screen.getByRole('checkbox', { name: 'Show password' });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Password')).toHaveValue('secret words');
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAccessibleName('Show password');
    await user.click(toggle);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('is a tick box, so pressing it never sends the form', () => {
    render(<Harness />);
    expect(screen.getByRole('checkbox', { name: 'Show password' })).toHaveAttribute('type', 'checkbox');
  });

  it('keeps the hint tied to the box and passes other props through', () => {
    render(<Harness hint="At least 8 characters." autoComplete="new-password" />);
    const box = screen.getByLabelText('Password');
    expect(box).toHaveAccessibleDescription('At least 8 characters.');
    expect(box).toHaveAttribute('autocomplete', 'new-password');
  });

  it('lets one toggle control two boxes and draws only one tick box', async () => {
    const user = userEvent.setup();
    render(<Pair />);
    expect(screen.getAllByRole('checkbox', { name: 'Show password' })).toHaveLength(1);
    await user.click(screen.getByRole('checkbox', { name: 'Show password' }));
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Type it again')).toHaveAttribute('type', 'text');
  });
});

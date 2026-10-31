import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import RedeemInvite from '@/pages/RedeemInvite';
import ResetPassword from '@/pages/ResetPassword';
import { AuthProvider } from '@/lib/AuthContext';

// Every page that asks for a password offers one "Show password" switch (the design's account
// entry frames). The reset page has two boxes and one switch that controls both.
const PAGES = [
  ['Login', '/login', <Login key="Login" />, ['Password']],
  ['Register', '/register', <Register key="Register" />, ['Password']],
  ['RedeemInvite', '/redeem-invite?token=abc', <RedeemInvite key="RedeemInvite" />, ['Password']],
  ['ResetPassword', '/reset-password?token=abc', <ResetPassword key="ResetPassword" />, ['New password', 'Confirm new password']],
];

describe.each(PAGES)('%s', (_name, path, element, labels) => {
  const show = () => render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path={path.split('?')[0]} element={element} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

  it('has exactly one Show password switch and it reveals every password box', async () => {
    const user = userEvent.setup();
    show();
    for (const label of labels) expect(screen.getByLabelText(label)).toHaveAttribute('type', 'password');
    const switches = screen.getAllByRole('checkbox', { name: /^Show password/ });
    expect(switches).toHaveLength(1);
    await user.click(switches[0]);
    for (const label of labels) expect(screen.getByLabelText(label)).toHaveAttribute('type', 'text');
    await user.click(switches[0]);
    for (const label of labels) expect(screen.getByLabelText(label)).toHaveAttribute('type', 'password');
  });
});

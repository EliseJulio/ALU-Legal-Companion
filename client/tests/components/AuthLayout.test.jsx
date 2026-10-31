import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthLayout from '@/components/AuthLayout';

const show = (props = {}) => render(
  <MemoryRouter>
    <AuthLayout eyebrow="Recovery" title="Forgot your password?" intro="If an account exists, reset instructions will be sent." {...props}>
      <p>the form</p>
    </AuthLayout>
  </MemoryRouter>,
);

describe('AuthLayout', () => {
  it('has one level-one heading with the title and shows the label above it', () => {
    show();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Forgot your password?' })).toBeInTheDocument();
    expect(screen.getByText('Recovery')).toBeInTheDocument();
    expect(screen.getByText('If an account exists, reset instructions will be sent.')).toBeInTheDocument();
    expect(screen.getByText('the form')).toBeInTheDocument();
  });

  it('keeps the password reminder and the way to the emergency numbers on every page', () => {
    show();
    expect(screen.getByText(/Keep your password private/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Emergency help remains available/ })).toHaveAttribute('href', '/emergency');
  });

  it('does not add a second link called Emergency numbers, which the menu already owns', () => {
    show();
    expect(screen.queryAllByRole('link', { name: /Emergency numbers/i })).toHaveLength(0);
  });

  it('moves focus to the new heading when the page changes state, not on the first one', () => {
    const tree = (title) => (
      <MemoryRouter><AuthLayout title={title}><p>x</p></AuthLayout></MemoryRouter>
    );
    const { rerender } = render(tree('Create an ALU account'));
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();
    rerender(tree('Check your email'));
    expect(screen.getByRole('heading', { level: 1, name: 'Check your email' })).toHaveFocus();
  });

  it('leaves out the label and the intro when none is given', () => {
    show({ eyebrow: undefined, intro: undefined });
    expect(screen.queryByText('Recovery')).toBeNull();
  });
});

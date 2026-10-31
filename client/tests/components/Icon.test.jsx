import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Icon from '@/components/Icon';

describe('Icon', () => {
  it('is decoration and is hidden from a screen reader', () => {
    const { container } = render(<Icon name="menu" />);
    const span = container.querySelector('span');
    expect(span).toHaveAttribute('aria-hidden', 'true');
    expect(span).toHaveClass('material-symbols-outlined');
    expect(span).toHaveTextContent('menu');
  });

  it('takes a size from the class it is given', () => {
    const { container } = render(<Icon name="check" className="text-base" />);
    expect(container.querySelector('span')).toHaveClass('material-symbols-outlined', 'text-base');
  });

  it('adds nothing to the name of the link it sits in', () => {
    render(<a href="/x"><Icon name="home" />Home page</a>);
    expect(screen.getByRole('link', { name: 'Home page' })).toBeInTheDocument();
  });
});

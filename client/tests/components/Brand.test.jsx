import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Brand from '@/components/Brand';

const show = (props) => render(<MemoryRouter><Brand {...props} /></MemoryRouter>);

describe('Brand', () => {
  it('is a link home with the full name for a screen reader', () => {
    show();
    expect(screen.getByRole('link', { name: /Legal Companion/ })).toHaveAttribute('href', '/');
  });

  it('keeps the words for a screen reader when compact', () => {
    show({ compact: true });
    const words = screen.getByText('Legal Companion', { exact: false });
    expect(words).toHaveClass('lg:sr-only');
  });

  it('sets the name in the heading font, so the site uses two text fonts only', () => {
    show();
    const words = screen.getByText('Legal Companion', { exact: false });
    expect(words).toHaveClass('font-head');
    expect(words.className).not.toMatch(/font-brand/);
  });

  it('does not hide the words when it is not compact', () => {
    show();
    expect(screen.getByText('Legal Companion', { exact: false })).not.toHaveClass('lg:sr-only');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckRequest from '@/pages/CheckRequest';

const show = () => render(<MemoryRouter><CheckRequest /></MemoryRouter>);

describe('Check an anonymous request', () => {
  it('has one heading and says a lost code cannot be recovered', () => {
    show();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Lost codes cannot be recovered or reissued/)).toBeInTheDocument();
  });

  it('sends a question code and a booking code to the page that uses each', () => {
    show();
    expect(screen.getByRole('link', { name: 'Check a question' })).toHaveAttribute('href', '/ask/check');
    expect(screen.getByRole('link', { name: 'Check a booking' })).toHaveAttribute('href', '/directory/booking-check');
  });

  it('asks for no code itself', () => {
    show();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CrisisAlert from '@/components/CrisisAlert';
import ErrorNotice from '@/components/ErrorNotice';

describe('CrisisAlert', () => {
  it('is announced as an alert', () => {
    render(<CrisisAlert />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('gives Isange and the Police as phone links', () => {
    render(<CrisisAlert />);
    expect(screen.getByRole('link', { name: /3029/ })).toHaveAttribute('href', 'tel:3029');
    expect(screen.getByRole('link', { name: /112/ })).toHaveAttribute('href', 'tel:112');
  });

  it('uses a level 3 heading so it stays out of the list of page sections', () => {
    render(<CrisisAlert />);
    expect(screen.getByRole('heading', { level: 3, name: /in danger right now/ })).toBeInTheDocument();
  });

  it('is outlined and not filled', () => {
    render(<CrisisAlert />);
    expect(screen.getByRole('alert').className).not.toMatch(/(^|\s)bg-warning(\s|$)/);
  });
});

describe('ErrorNotice', () => {
  it('shows the message from the error as an alert', () => {
    render(<ErrorNotice error={{ message: 'Could not reach the server.' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server.');
  });

  it('does not look like the crisis block', () => {
    render(<ErrorNotice error={{ message: 'x' }} />);
    expect(screen.getByRole('alert').className).not.toMatch(/border-l-warning/);
  });
});

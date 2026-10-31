import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '@/components/ErrorBoundary';

function Broken() {
  throw new Error('Something broke inside');
}

describe('ErrorBoundary', () => {
  it('shows its children when nothing is wrong', () => {
    render(<ErrorBoundary><p>All fine</p></ErrorBoundary>);
    expect(screen.getByText('All fine')).toBeInTheDocument();
  });

  it('shows a plain message and a reload button when a child throws', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('Something broke inside')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
    quiet.mockRestore();
  });

  it('writes the full error to the console for the developer', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(quiet.mock.calls.some(([first]) => first === '[ErrorBoundary]')).toBe(true);
    quiet.mockRestore();
  });
});

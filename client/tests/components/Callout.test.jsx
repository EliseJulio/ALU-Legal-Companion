import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Callout from '@/components/Callout';

describe('Callout', () => {
  it('shows the title and the words', () => {
    render(<Callout title="Private by default">Only you can see it.</Callout>);
    expect(screen.getByText('Private by default')).toBeInTheDocument();
    expect(screen.getByText('Only you can see it.')).toBeInTheDocument();
  });

  it('is not an alert, so a screen reader does not announce it on every visit', () => {
    render(<Callout title="Note">Text</Callout>);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('works without a title', () => {
    render(<Callout>Just the words.</Callout>);
    expect(screen.getByText('Just the words.')).toBeInTheDocument();
  });

  it('takes an extra class for spacing', () => {
    render(<Callout className="mt-6">Spaced</Callout>);
    expect(screen.getByText('Spaced').closest('div[class*="border-l-4"]')).toHaveClass('mt-6');
  });
});

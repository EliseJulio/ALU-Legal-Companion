import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmergencyLink from '@/components/EmergencyLink';

const show = (props) => render(<MemoryRouter><EmergencyLink {...props} /></MemoryRouter>);

describe('EmergencyLink', () => {
  it('links to the urgent numbers with its name in full', () => {
    show();
    expect(screen.getByRole('link', { name: 'Emergency numbers' })).toHaveAttribute('href', '/emergency');
  });

  it('keeps the words on the screen when compact, small and under the icon', () => {
    show({ compact: true });
    const link = screen.getByRole('link', { name: 'Emergency numbers' });
    expect(link).toHaveClass('lg:flex-col');
    expect(link).not.toHaveClass('lg:sr-only');
    expect(link.querySelector('.lg\:sr-only')).toBeNull();
  });

  it('is a pill at every size when it is not compact', () => {
    show();
    expect(screen.getByRole('link', { name: 'Emergency numbers' })).toHaveClass('rounded-pill');
  });
});

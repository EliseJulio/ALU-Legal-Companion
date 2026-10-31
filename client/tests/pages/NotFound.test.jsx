import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '@/pages/NotFound';

const show = () => render(<MemoryRouter><NotFound /></MemoryRouter>);

// The design asks for a 404 that helps a lost person: a way back, the main places to go next, and
// emergency help a click away. It must never be a dead end.
describe('Page not found', () => {
  it('says the page is missing and has one level-one heading', () => {
    show();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });

  it('leads back to the home page and to the main places', () => {
    show();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Find where a matter goes first' })).toHaveAttribute('href', '/where-to-go');
    expect(screen.getByRole('link', { name: 'Read the legal guides' })).toHaveAttribute('href', '/guides');
    expect(screen.getByRole('link', { name: 'Look in the directory' })).toHaveAttribute('href', '/directory');
    expect(screen.getByRole('link', { name: 'Search the site' })).toHaveAttribute('href', '/search');
  });

  it('keeps emergency help one click away without a second link called Emergency numbers', () => {
    show();
    expect(screen.getByRole('link', { name: 'See all emergency contacts' })).toHaveAttribute('href', '/emergency');
    expect(screen.queryAllByRole('link', { name: /^Emergency numbers$/ })).toHaveLength(0);
  });
});

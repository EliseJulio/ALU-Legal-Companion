import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import { AuthProvider } from '@/lib/AuthContext';

function mount(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.scrollTo = vi.fn();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, status: 200, headers: { get: () => null }, json: async () => [],
  });
});

describe('App routes', () => {
  it('opens the landing page at /', () => {
    mount('/');
    expect(screen.getByRole('heading', { level: 1, name: /Understand your issue/ })).toBeInTheDocument();
  });

  it('opens the urgent help page at /emergency', () => {
    mount('/emergency');
    expect(screen.getByRole('heading', { level: 1, name: 'Emergency numbers' })).toBeInTheDocument();
  });

  it('shows Page not found for an unknown address', () => {
    mount('/nowhere');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });

  it('scrolls to the top when the page changes', () => {
    mount('/emergency');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

describe('Landing page', () => {
  it('links each way in to the page where it lives', () => {
    mount('/');
    expect(screen.getByRole('link', { name: 'Explore Work' })).toHaveAttribute('href', '/guides?domain=employment');
    expect(screen.getByRole('link', { name: 'Explore Legal Guides' })).toHaveAttribute('href', '/guides');
    expect(screen.getByRole('link', { name: 'Find assistance in the Directory' })).toHaveAttribute('href', '/directory');
    expect(screen.getAllByRole('link', { name: 'Find Where to Go' })[0]).toHaveAttribute('href', '/where-to-go');
  });

  it('puts the urgent numbers in a labelled region and not in an alert', () => {
    mount('/');
    const region = screen.getByRole('region', { name: 'In danger, or has someone hurt you?' });
    expect(region).toHaveTextContent('3029');
    expect(region).toHaveTextContent('112');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('never mentions the assistant', () => {
    mount('/');
    expect(document.body.textContent).not.toMatch(/assistant|artificial|\bAI\b/i);
  });
});

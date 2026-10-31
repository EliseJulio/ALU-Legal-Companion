import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';

const show = (props) => render(<MemoryRouter><Breadcrumb {...props} /></MemoryRouter>);

describe('Breadcrumb', () => {
  it('is a labelled navigation that reads like a path', () => {
    show({ trail: [{ label: 'Home', to: '/' }, { label: 'Where to Go', to: '/where-to-go' }], current: 'A matter' });
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Home / Where to Go / A matter');
  });

  it('links the parts above the page and not the page itself', () => {
    show({ trail: [{ label: 'Home', to: '/' }, { label: 'Directory', to: '/directory' }], current: 'Book' });
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Directory' })).toHaveAttribute('href', '/directory');
    expect(screen.queryByRole('link', { name: 'Book' })).not.toBeInTheDocument();
  });

  it('marks the current page for a screen reader', () => {
    show({ trail: [], current: 'Here' });
    expect(screen.getByText('Here')).toHaveAttribute('aria-current', 'page');
  });

  it("shows a part with no address as plain text", () => {
    show({ trail: [{ label: "Admin workspace" }], current: "People" });
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Admin workspace / People");
    expect(screen.queryByRole("link", { name: "Admin workspace" })).not.toBeInTheDocument();
  });
});

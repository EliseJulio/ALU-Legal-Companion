import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProviderCard from '@/components/ProviderCard';

const PROVIDER = {
  id: 7,
  name: 'Example Legal Aid Office',
  type: 'maj_office',
  location: 'Kigali',
  contact: '+250 788 000 000',
  services: 'Free advice on land and labour matters.',
  languages: 'English, Kinyarwanda',
  is_free: true,
  bookable: true,
  last_checked_at: '2026-09-01',
  stale: false,
  verified_at: '2026-09-02T09:00:00Z',
};

const show = (overrides = {}) => render(
  <MemoryRouter><ul><ProviderCard provider={{ ...PROVIDER, ...overrides }} /></ul></MemoryRouter>,
);

describe('ProviderCard', () => {
  it('shows the name and the kind of body in words', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Example Legal Aid Office' })).toBeInTheDocument();
    expect(screen.getByText(/Legal aid office \(MAJ\)/)).toBeInTheDocument();
    expect(screen.queryByText(/maj_office/)).not.toBeInTheDocument();
  });

  it('turns a web address in the contact line into a link that opens in a new tab', () => {
    show({ contact: 'nurse@example.org · https://calendar.example.org/book/abc' });
    expect(screen.getByText(/nurse@example.org/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Book a session/ });
    expect(link).toHaveAttribute('href', 'https://calendar.example.org/book/abc');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('never links an address that is not https', () => {
    show({ contact: 'javascript:alert(1) http://plain.example.org' });
    expect(screen.queryByRole('link', { name: /Book a session/ })).not.toBeInTheDocument();
  });

  it('shows how to reach it, the languages and the cost', () => {
    show();
    expect(screen.getByText('+250 788 000 000')).toBeInTheDocument();
    expect(screen.getByText('English, Kinyarwanda')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('warns that a paid office may charge', () => {
    show({ is_free: false });
    expect(screen.getByText(/May charge a fee/)).toBeInTheDocument();
  });

  it('links to the booking page when the office takes bookings', () => {
    show();
    expect(screen.getByRole('link', { name: 'Request consultation with Example Legal Aid Office' })).toHaveAttribute('href', '/directory/book/7');
  });

  it('has no booking link when the office does not take bookings', () => {
    show({ bookable: false });
    expect(screen.queryByRole('link', { name: 'Request consultation with Example Legal Aid Office' })).not.toBeInTheDocument();
    expect(screen.getByText(/does not take online bookings/)).toBeInTheDocument();
  });

  it('shows when it was last checked', () => {
    show();
    expect(screen.getByText(/Details last checked/)).toBeInTheDocument();
  });

  it('shows the address and the hours and what could not be confirmed', () => {
    show({ address: 'KG 7 Ave, Kigali', hours: 'Monday to Friday, 8am to 5pm', address_note: 'No plot number is published.' });
    expect(screen.getByText(/KG 7 Ave, Kigali/)).toBeInTheDocument();
    expect(screen.getByText('Monday to Friday, 8am to 5pm')).toBeInTheDocument();
    expect(screen.getByText('No plot number is published.')).toBeInTheDocument();
  });

  it('links to Google Maps with a search for the body and its address', () => {
    show({ address: 'KG 7 Ave, Kigali' });
    const link = screen.getByRole('link', { name: /^Open in Google Maps for Example Legal Aid Office/ });
    expect(link).toHaveAttribute('href', expect.stringContaining('query=Example%20Legal%20Aid%20Office%2C%20KG%207%20Ave%2C%20Kigali%2C%20Rwanda'));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('loads nothing from Google until the reader asks for the map', async () => {
    const { container } = show({ address: 'KG 7 Ave, Kigali' });
    expect(container.querySelector('iframe')).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Show map of Example Legal Aid Office' }));
    const frame = container.querySelector('iframe');
    expect(frame).toHaveAttribute('title', 'Map of Example Legal Aid Office');
    expect(frame.getAttribute('src')).toMatch(/^https:\/\/maps\.google\.com\/maps\?q=Example%20Legal%20Aid%20Office.*&output=embed$/);
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    await user.click(screen.getByRole('button', { name: 'Hide map of Example Legal Aid Office' }));
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('shows no map when no address is published but still shows the note', () => {
    const { container } = show({ address: null, address_note: 'Call 3029 first.' });
    expect(screen.queryByRole('link', { name: /Google Maps/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Show map/ })).not.toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText('Call 3029 first.')).toBeInTheDocument();
  });

  it('says plainly when the details are old', () => {
    show({ stale: true });
    expect(screen.getByText(/Confirm by phone first/)).toBeInTheDocument();
  });

  it('says nothing about age when the details are recent', () => {
    show();
    expect(screen.queryByText(/Confirm by phone first/)).not.toBeInTheDocument();
  });
});

describe('ProviderCard: the full listing and the booking block', () => {
  it('links the name to the full listing', () => {
    show();
    expect(screen.getByRole('link', { name: 'Example Legal Aid Office' })).toHaveAttribute('href', '/directory/7');
    expect(screen.getByRole('heading', { name: 'Example Legal Aid Office' })).toBeInTheDocument();
  });

  it('says in words whether bookings are open, and not by colour', () => {
    const { unmount } = show();
    expect(screen.getByText('Bookings open')).toBeInTheDocument();
    unmount();
    show({ bookable: false });
    expect(screen.getByText('Contact directly')).toBeInTheDocument();
  });

  it('can leave out the booking block for a page that has its own', () => {
    render(<MemoryRouter><ul><ProviderCard provider={PROVIDER} bare noBooking /></ul></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'Request consultation with Example Legal Aid Office' })).not.toBeInTheDocument();
    expect(screen.queryByText(/does not take online bookings/)).not.toBeInTheDocument();
  });

  it('offers an Expand listing button on a contact-direct card and not on a bookable one', () => {
    const { unmount } = show({ bookable: false });
    expect(screen.getByRole('link', { name: 'Expand listing for Example Legal Aid Office' })).toHaveAttribute('href', '/directory/7');
    unmount();
    show({ bookable: true });
    expect(screen.queryByRole('link', { name: /Expand listing/ })).not.toBeInTheDocument();
  });

  it('makes the action button the width of the card on a phone', () => {
    const { unmount } = show({ bookable: true });
    expect(screen.getByRole('link', { name: 'Request consultation with Example Legal Aid Office' })).toHaveClass('w-full', 'sm:w-auto');
    unmount();
    show({ bookable: false });
    expect(screen.getByRole('link', { name: /Expand listing/ })).toHaveClass('w-full', 'sm:w-auto');
  });

  it('has no Expand listing button on a page that already is the listing or leads to it', () => {
    render(<MemoryRouter><ul><ProviderCard provider={{ ...PROVIDER, bookable: false }} bare /></ul></MemoryRouter>);
    expect(screen.queryByRole('link', { name: /Expand listing/ })).not.toBeInTheDocument();
  });

  it('still shows the booking block on the route page, which uses bare only', () => {
    render(<MemoryRouter><ul><ProviderCard provider={PROVIDER} bare /></ul></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Request consultation with Example Legal Aid Office' })).toHaveAttribute('href', '/directory/book/7');
  });
});

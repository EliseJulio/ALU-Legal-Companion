import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProviderDetail from '@/pages/ProviderDetail';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const PROVIDER = {
  id: 7, name: 'Example Pro Bono Lawyer', type: 'pro_bono_lawyer', location: 'Kigali',
  contact: '0788 000 000', services: 'Free advice on rent and work.', languages: 'English, Kinyarwanda',
  is_free: true, bookable: true, address: 'KG 7 Ave, Kigali', hours: 'Mon to Fri, 8:00 to 17:00',
  official_source_url: 'https://example.org/lawyer', last_checked_at: '2026-09-01', stale: false,
  verified_at: '2026-09-02T09:00:00Z',
};

const show = () => render(
  <MemoryRouter initialEntries={['/directory/7']}>
    <Routes><Route path="/directory/:id" element={<ProviderDetail />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(reply(200, PROVIDER));
});

describe('Provider detail', () => {
  it('asks the server for this listing', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/directory\/providers\/7$/);
  });

  it('shows the name and a breadcrumb that leads back to the directory', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Example Pro Bono Lawyer' })).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs).toHaveTextContent('Home / Directory / Example Pro Bono Lawyer');
    expect(within(crumbs).getByRole('link', { name: 'Directory' })).toHaveAttribute('href', '/directory');
    // One way back, not two.
    expect(screen.queryByRole('link', { name: 'Back to results' })).not.toBeInTheDocument();
  });

  it('has one h1 and shows the kind of body in words', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Pro-bono lawyer · Kigali/)).toBeInTheDocument();
    expect(screen.queryByText(/pro_bono_lawyer/)).not.toBeInTheDocument();
  });

  it('offers a booking and the booking check when the listing takes bookings', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('link', { name: /^Request consultation/ })).toHaveLength(1);
    // The name says which office, so it is not the same words as the link on any other listing.
    const book = screen.getByRole('link', { name: 'Request consultation with Example Pro Bono Lawyer' });
    expect(book).toHaveAttribute('href', '/directory/book/7');
    expect(screen.getByRole('link', { name: 'Check an existing booking' })).toHaveAttribute('href', '/directory/booking-check');
  });

  it('has no category buttons. The breadcrumb leads back to the directory', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('navigation', { name: 'Browse by category' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Directory' })).toHaveAttribute('href', '/directory');
  });

  it('shows the booking and the retrieval as two tiles, each with its helper line', async () => {
    show();
    const panel = (await screen.findByRole('heading', { name: 'Consultation requests' })).closest('section');
    const booking = within(panel).getByRole('heading', { level: 3, name: 'Booking' }).parentElement;
    expect(booking).toHaveTextContent('Anonymous requests do not require your name or email. Keep the one-time retrieval code.');
    expect(within(booking).getByRole('link', { name: /^Request consultation/ })).toBeInTheDocument();
    const retrieval = within(panel).getByRole('heading', { level: 3, name: 'Retrieval' }).parentElement;
    expect(retrieval).toHaveTextContent('Use your retrieval code to return to the response.');
    expect(within(retrieval).getByRole('link', { name: 'Check an existing booking' })).toHaveAttribute('href', '/directory/booking-check');
  });

  it('has no consultation panel at all when the listing takes no bookings', async () => {
    global.fetch.mockResolvedValue(reply(200, { ...PROVIDER, bookable: false }));
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('heading', { name: 'Consultation requests' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Check an existing booking' })).not.toBeInTheDocument();
  });

  it('offers no booking link when the listing is contact-direct and says so once', async () => {
    global.fetch.mockResolvedValue(reply(200, { ...PROVIDER, bookable: false }));
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /^Request consultation/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/does not take online bookings/)).toHaveLength(1);
  });

  it('shows the official page and when the details were last checked in Sources and review', async () => {
    show();
    const panel = (await screen.findByRole('heading', { name: 'Sources & review' })).closest('section');
    expect(within(panel).getByRole('link', { name: /Open the official page/ })).toHaveAttribute('href', 'https://example.org/lawyer');
    expect(within(panel).getByText('Details last checked')).toBeInTheDocument();
    expect(within(panel).getByText(/1 September 2026|September 1, 2026/)).toBeInTheDocument();
  });

  it('shows how to reach the office once, on the card', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByText('0788 000 000')).toHaveLength(1);
    expect(screen.getAllByText(/KG 7 Ave, Kigali/)).toHaveLength(1);
    expect(screen.getAllByText('Mon to Fri, 8:00 to 17:00')).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Contact directly' })).not.toBeInTheDocument();
  });

  it('says in words when no contact details have been recorded', async () => {
    global.fetch.mockResolvedValue(reply(200, { ...PROVIDER, contact: null, address: null, hours: null }));
    show();
    const panel = (await screen.findByRole('heading', { name: 'Contact directly' })).closest('section');
    expect(panel).toHaveTextContent('No contact details have been recorded.');
  });

  it('links the official source when it is https', async () => {
    show();
    const link = await screen.findByRole('link', { name: /Open the official page for Example Pro Bono Lawyer/ });
    expect(link).toHaveAttribute('href', 'https://example.org/lawyer');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('never makes a link from an official source that is not https', async () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'http://example.org/x', 'not a url']) {
      global.fetch.mockResolvedValue(reply(200, { ...PROVIDER, official_source_url: bad }));
      const view = show();
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByRole('link', { name: /Open the official page/ })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it('warns the reader not to include names or identity numbers', async () => {
    show();
    expect(await screen.findByText('Before making a request')).toBeInTheDocument();
    expect(screen.getByText(/identity numbers/)).toBeInTheDocument();
  });

  it('has no demonstration labels', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(document.body.textContent).not.toMatch(/Demonstration|Not a live recommendation|Not provided/);
  });

  it('says the listing is not in the directory and leads back', async () => {
    global.fetch.mockResolvedValue(reply(404, { error: 'That listing is not in the directory' }));
    show();
    expect(await screen.findByText('That listing is not in the directory')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'This listing is not available' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the directory' })).toHaveAttribute('href', '/directory');
  });
});
